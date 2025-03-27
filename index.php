<?php
require_once __DIR__ . '/vendor/autoload.php';

// Load environment variables
$dotenv = \Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Create OpenAI client
$client = \OpenAI::client($_ENV['OPENAI_API_KEY']);

// Handle API requests
if (isset($_GET['action'])) {
    header('Content-Type: application/json');
    
    if ($_GET['action'] === 'create_mindmap' && isset($_POST['topic'])) {
        $topic = $_POST['topic'];
        
        try {
            // Make the OpenAI request
            $response = $client->chat()->create([
                'model' => 'gpt-4o-mini',
                'messages' => [
                    ['role' => 'system', 'content' => 'You are a helpful assistant that creates mind maps. Create a mind map with exactly 4 subtopics for the given main topic. The subtopics MUST be direct components/aspects of the main topic only. Each subtopic must be concise and ONLY 2-4 words long for better visualization. Also provide a brief paragraph explaining the main topic.'],
                    ['role' => 'user', 'content' => "Create a mind map for the topic: '{$topic}'. Remember that you must provide EXACTLY 4 subtopics, each 2-4 words long. Respond in this exact JSON format: {\"content\": \"paragraph describing the topic\", \"subtopics\": [\"subtopic1 (2-4 words)\", \"subtopic2 (2-4 words)\", \"subtopic3 (2-4 words)\", \"subtopic4 (2-4 words)\"]}"]
                ],
                'temperature' => 0.7,
                'max_tokens' => 1000
            ]);
            
            // Parse and sanitize the response
            $content = $response->choices[0]->message->content;
            $data = json_decode($content, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                // Try to extract JSON if not properly formatted
                preg_match('/\{.*\}/s', $content, $matches);
                if (!empty($matches)) {
                    $data = json_decode($matches[0], true);
                }
            }
            
            if (!isset($data['content']) || !isset($data['subtopics'])) {
                throw new Exception("Invalid response format");
            }
            
            echo json_encode([
                'content' => $data['content'],
                'subtopics' => array_slice($data['subtopics'], 0, 4) // Ensure exactly 4 subtopics
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        
        exit;
    }
    
    if ($_GET['action'] === 'get_content' && isset($_POST['topic'])) {
        $topic = $_POST['topic'];
        $context = isset($_POST['context']) ? $_POST['context'] : '';
        $expandCount = isset($_POST['expandCount']) ? (int)$_POST['expandCount'] : 1;
        
        // Create an array of context topics
        $contextPath = !empty($context) ? explode('|', $context) : [];
        
        // Get the original root topic (if available)
        $rootTopic = !empty($contextPath) ? $contextPath[0] : $topic;
        
        try {
            // Build a context-aware prompt
            $contextDescription = '';
            if (!empty($contextPath)) {
                $contextDescription = "This is part of a mind map about \"$rootTopic\". ";
                $contextDescription .= "The full context path is: " . implode(" > ", $contextPath) . " > $topic. ";
                $contextDescription .= "Generate content and subtopics specifically for \"$topic\" while maintaining relevance to this context path.";
            }
            
            // Additional topics logic
            $additionalInstructions = '';
            if ($expandCount > 1) {
                $additionalInstructions = "This is expansion #$expandCount for this topic. Generate 4 NEW and DIFFERENT subtopics than what was previously generated. Make sure these new subtopics are also relevant and don't overlap with previous ones.";
            }
            
            // Make the OpenAI request
            $response = $client->chat()->create([
                'model' => 'gpt-4o-mini',
                'messages' => [
                    ['role' => 'system', 'content' => 'You are a helpful assistant that creates mind maps. For a given subtopic, provide a concise but informative paragraph explaining it and generate exactly 4 further subtopics that branch from it. Each subtopic MUST be only 2-4 words long for better visualization. The subtopics must be direct aspects/components of the current topic while maintaining relevance to the overall context path.'],
                    ['role' => 'user', 'content' => "Provide information about the subtopic: '{$topic}'. {$contextDescription} {$additionalInstructions} Remember to provide EXACTLY 4 subtopics, each 2-4 words long. Respond in this exact JSON format: {\"content\": \"paragraph describing the subtopic\", \"subtopics\": [\"subtopic1 (2-4 words)\", \"subtopic2 (2-4 words)\", \"subtopic3 (2-4 words)\", \"subtopic4 (2-4 words)\"]}"]
                ],
                'temperature' => $expandCount > 1 ? 0.9 : 0.7, // Increase creativity for additional topics
                'max_tokens' => 1000
            ]);
            
            // Parse and sanitize the response
            $content = $response->choices[0]->message->content;
            $data = json_decode($content, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                // Try to extract JSON if not properly formatted
                preg_match('/\{.*\}/s', $content, $matches);
                if (!empty($matches)) {
                    $data = json_decode($matches[0], true);
                }
            }
            
            if (!isset($data['content']) || !isset($data['subtopics'])) {
                throw new Exception("Invalid response format");
            }
            
            echo json_encode([
                'content' => $data['content'],
                'subtopics' => array_slice($data['subtopics'], 0, 4) // Ensure exactly 4 subtopics
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        
        exit;
    }
    
    // If we get here, it's an invalid action
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Neural Noodler 5000</title>
    <link rel="stylesheet" href="assets/style.css">
    <!-- Include vis.js -->
    <script src="https://cdn.jsdelivr.net/npm/vis-network/standalone/umd/vis-network.min.js"></script>
</head>
<body>
    <div class="container">
        <div class="content-wrapper">
            <div id="mindmap-container">
                <!-- Mind map will be rendered here -->
                <div class="legend">
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #9c27b0;"></span>
                        <span class="legend-label">Current Path</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #ff9800;"></span>
                        <span class="legend-label">Hover Path</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #FF9800;"></span>
                        <span class="legend-label">1st Expansion</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #4CAF50;"></span>
                        <span class="legend-label">2nd Expansion</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #F44336;"></span>
                        <span class="legend-label">3rd Expansion</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #9C27B0;"></span>
                        <span class="legend-label">4th Expansion</span>
                    </div>
                </div>
            </div>

            <div id="content-panel" class="content-panel">
                <button id="close-panel" class="close-panel">×</button>
                
                <div class="sidebar-header">
                    <h1>The Neural Noodler 5000</h1>
                    <p>Plot a course through your curiosity.</p>
                </div>
                
                <div class="input-container">
                    <input type="text" id="topic-input" class="topic-input" placeholder="e.g. Studio Ghibli">
                    <button id="submit-btn" class="submit-btn">Noodle It</button>
                </div>
                
                <div id="content-area">
                    <div class="content-section initial-content">
                        <h3 class="content-title">Welcome</h3>
                        <div class="content-text">
🚀 Initiate cognitive scan by entering a topic and hitting “Noodle It.”

As the neural grid unfolds, engage any node to reveal deeper knowledge clusters.

Each node expansion deploys 4 subtopics. Re-engaging an active node will retrieve 4 additional intel nodes from the mindstream.

Your exploration log is displayed in this panel, tracking your most recent thought jumps at the top.
                        </div>
                    </div>
                    <div id="content-text" style="display: none;"></div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="assets/mindmap.js"></script>
</body>
</html> 