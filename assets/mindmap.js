document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const topicInput = document.getElementById('topic-input');
    const submitBtn = document.getElementById('submit-btn');
    const mindmapContainer = document.getElementById('mindmap-container');
    const contentPanel = document.getElementById('content-panel');
    const contentArea = document.getElementById('content-area');
    const contentText = document.getElementById('content-text');
    const closePanel = document.getElementById('close-panel');

    // Nodes and edges data
    let nodes = new vis.DataSet([]);
    let edges = new vis.DataSet([]);
    let network = null;
    let nodeIdCounter = 1;

    // Initialize the network
    function initNetwork() {
        const data = {
            nodes: nodes,
            edges: edges
        };

        const options = {
            nodes: {
                shape: 'box',
                margin: 15,
                widthConstraint: {
                    maximum: 150
                },
                heightConstraint: {
                    minimum: 30
                },
                font: {
                    size: 14,
                    face: 'Arial'
                },
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.2)',
                    size: 5
                },
                shapeProperties: {
                    borderRadius: 5
                },
                scaling: {
                    min: 10,
                    max: 30
                }
            },
            edges: {
                width: 2,
                color: {
                    color: '#2B7CE9',
                    highlight: '#1553B7'
                },
                smooth: {
                    type: 'dynamic',
                    forceDirection: 'none',
                    roundness: 0.5
                },
                arrows: {
                    to: {
                        enabled: false
                    }
                }
            },
            physics: {
                enabled: true,
                stabilization: {
                    enabled: true,
                    iterations: 1000,
                    updateInterval: 100,
                    fit: true
                },
                barnesHut: {
                    gravitationalConstant: -2000,
                    centralGravity: 0.1,
                    springLength: 200,
                    springConstant: 0.04,
                    damping: 0.09,
                    avoidOverlap: 1
                },
                repulsion: {
                    nodeDistance: 150,
                    centralGravity: 0.1
                },
                solver: 'barnesHut',
                wind: { x: 0, y: 0 },
                timestep: 0.5
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                hideEdgesOnDrag: true,
                navigationButtons: true,
                keyboard: {
                    enabled: true,
                    bindToWindow: false  // Only enable keyboard navigation when not focused on input
                },
                multiselect: false,
                dragNodes: true,
                dragView: true,
                zoomView: true
            },
            layout: {
                improvedLayout: true,
                hierarchical: {
                    enabled: false
                }
            },
            autoResize: true,
            height: '100%',
            width: '100%'
        };

        network = new vis.Network(mindmapContainer, data, options);
        
        // Add resize handling
        window.addEventListener('resize', function() {
            network.fit();
        });
        
        // Disable keyboard navigation when the input field is focused
        topicInput.addEventListener('focus', function() {
            network.setOptions({
                interaction: {
                    keyboard: {
                        enabled: false
                    }
                }
            });
        });
        
        // Re-enable keyboard navigation when the input field loses focus
        topicInput.addEventListener('blur', function() {
            network.setOptions({
                interaction: {
                    keyboard: {
                        enabled: true,
                        bindToWindow: false
                    }
                }
            });
        });

        // Event listener for node clicks
        network.on('click', function(params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = nodes.get(nodeId);
                
                // Reset all nodes and edges to default appearance
                resetNodesAndEdges();
                
                // Highlight selected node
                if (node && node.id !== 1) { // Skip main node which has its own style
                    nodes.update({
                        id: nodeId,
                        color: {
                            background: '#e6f2ff',
                            border: '#2B7CE9',
                            highlight: {
                                background: '#e6f2ff',
                                border: '#2B7CE9'
                            }
                        },
                        font: {
                            color: '#343434'
                        }
                    });
                    
                    // Highlight the path to this node
                    highlightPathToNode(nodeId, '#9c27b0'); // Use purple for active path
                }
                
                // Zoom to the selected node and its immediate connections
                if (node) {
                    const connectedNodes = network.getConnectedNodes(nodeId);
                    const nodesToShow = [nodeId, ...connectedNodes];
                    const options = {
                        nodes: nodesToShow,
                        animation: {
                            duration: 1000,
                            easingFunction: 'easeOutQuint'
                        },
                        scale: 0.8  // Slightly zoomed in view
                    };
                    network.fit(options);
                    
                    // Don't update the main content title anymore
                    // contentTitle.textContent = node.label;
                    contentText.textContent = 'Loading...';
                    
                    // Show loading content immediately
                    const displayTitle = node.fullTopic || node.label;
                    showLoadingContent(displayTitle);
                    
                    // Force browser to recognize the panel
                    setTimeout(() => {
                        if (!node.expanded) {
                            // First time clicking - expand with initial subtopics
                            // Get context path for this node
                            const contextPath = getNodeContextPath(nodeId);
                            
                            // Get content for the clicked node with context
                            fetchNodeContent(node.label, contextPath)
                                .then(data => {
                                    // Remove loading status
                                    removeLoadingContent();
                                    
                                    // Show content in the panel
                                    showContentPanel(node.label, data.content);
                                    
                                    // Expand the node with subtopics if not already expanded
                                    expandNode(node, data.subtopics, node.label, contextPath);
                                    
                                    // Store the content with the node
                                    nodes.update({
                                        id: nodeId,
                                        content: data.content,
                                        expanded: true,
                                        expandCount: 1
                                    });
                                })
                                .catch(error => {
                                    // Remove loading status on error
                                    removeLoadingContent();
                                    
                                    console.error('Error:', error);
                                    
                                    // Show error content
                                    showContentPanel(node.label, 'Error loading content. Please try again.');
                                });
                        } else {
                            // Node already expanded - show content and possibly expand more
                            if (node.content) {
                                // Remove loading status
                                removeLoadingContent();
                                
                                // Show the stored content
                                showContentPanel(node.label, node.content);
                            }
                            
                            // If clicked again on already expanded node, fetch additional subtopics
                            const expandCount = node.expandCount || 1;
                            const contextPath = getNodeContextPath(nodeId);
                            
                            // Add a parameter to indicate we want additional topics
                            fetchNodeContent(node.label, contextPath, expandCount)
                                .then(data => {
                                    // Expand the node with additional subtopics
                                    expandNode(node, data.subtopics, node.label, contextPath, true);
                                    
                                    // Update the expandCount for this node
                                    nodes.update({
                                        id: nodeId,
                                        expandCount: expandCount + 1
                                    });
                                })
                                .catch(error => {
                                    console.error('Error fetching additional topics:', error);
                                });
                        }
                    }, 10);
                }
            }
        });
        
        // Event listener for node hover
        network.on('hoverNode', function(params) {
            const nodeId = params.node;
            
            // Temporarily highlight the path on hover
            if (nodeId) {
                // Don't reset the full network, just add hover highlights
                highlightPathToNode(nodeId, '#ff9800', true); // Use orange for hover path
            }
        });
        
        // Event listener for blur hover
        network.on('blurNode', function(params) {
            // Reset all hover highlights
            const selectedNodeId = network.getSelectedNodes()[0];
            
            // Reset all nodes and edges to default
            resetNodesAndEdges();
            
            // If there's a selected node, re-highlight its path
            if (selectedNodeId) {
                highlightPathToNode(selectedNodeId, '#9c27b0'); // Use purple for active path
            }
        });
    }

    // Function to reset all nodes and edges to default appearance
    function resetNodesAndEdges() {
        const allNodes = nodes.get();
        allNodes.forEach(n => {
            if (n.id !== 1) { // Skip main node which has its own style
                nodes.update({
                    id: n.id,
                    color: {
                        background: 'white',
                        border: '#2B7CE9'
                    },
                    font: {
                        color: '#343434'
                    }
                });
            }
        });
        
        // Reset all edges to default style
        const allEdges = edges.get();
        allEdges.forEach(e => {
            edges.update({
                id: e.id,
                color: {
                    color: '#2B7CE9',
                    highlight: '#1553B7'
                },
                width: 2
            });
        });
    }

    // Function to highlight the path to a node
    function highlightPathToNode(nodeId, pathColor, isHoverEffect = false) {
        // Get the full path to the node
        const path = getNodeContextPath(nodeId);
        path.push({ id: nodeId }); // Add the current node to the path
        
        // Highlight all nodes in the path
        path.forEach(item => {
            // Don't change root node styling
            if (item.id !== 1) {
                const nodeUpdate = {
                    id: item.id
                };
                
                // For hover effect, we use a lighter styling
                if (isHoverEffect) {
                    nodeUpdate.borderWidth = 2;
                    nodeUpdate.color = {
                        border: pathColor
                    };
                } else {
                    // For selected path, use stronger styling
                    nodeUpdate.color = {
                        background: '#f5f5f5',
                        border: pathColor,
                    };
                    nodeUpdate.borderWidth = 2;
                }
                
                nodes.update(nodeUpdate);
            }
        });
        
        // Highlight all edges in the path
        for (let i = 0; i < path.length - 1; i++) {
            const fromId = path[i].id;
            const toId = path[i + 1].id;
            
            // Find edge connecting these nodes
            const allEdges = edges.get();
            const connectingEdge = allEdges.find(e => e.from === fromId && e.to === toId);
            
            if (connectingEdge) {
                const edgeUpdate = {
                    id: connectingEdge.id,
                    color: pathColor,
                    width: isHoverEffect ? 3 : 4
                };
                
                edges.update(edgeUpdate);
            }
        }
    }

    // Function to show the loading indicator
    function showLoading() {
        const loading = document.createElement('div');
        loading.id = 'loading-indicator';
        loading.className = 'loading';
        loading.textContent = 'Loading...';
        mindmapContainer.appendChild(loading);
    }

    // Function to hide the loading indicator
    function hideLoading() {
        const loading = document.getElementById('loading-indicator');
        if (loading) {
            loading.remove();
        }
    }

    // Function to limit topic text to 2-4 words
    function limitTopicLength(topic) {
        // Split the topic into words
        const words = topic.split(/\s+/);
        
        // If it's already 4 words or fewer, return as is
        if (words.length <= 4) {
            return topic;
        }
        
        // Otherwise, take the first 4 words and add an ellipsis
        return words.slice(0, 4).join(' ') + '...';
    }

    // Function to show content in the panel
    function showContentPanel(title, content) {
        // Use the full topic if available, otherwise use the limited title
        const selectedNodeId = network.getSelectedNodes()[0];
        let displayTitle = title;
        
        if (selectedNodeId) {
            const node = nodes.get(selectedNodeId);
            if (node && node.fullTopic) {
                // Use the full topic name in the content panel
                displayTitle = node.fullTopic;
            }
        }
        
        // Create a new content section
        const newContentSection = document.createElement('div');
        newContentSection.className = 'content-section';
        
        // Add title
        const titleElement = document.createElement('h3');
        titleElement.className = 'content-title';
        titleElement.textContent = displayTitle;
        newContentSection.appendChild(titleElement);
        
        // Add content as paragraphs
        const contentElement = document.createElement('div');
        contentElement.className = 'content-text';
        
        // Split content into paragraphs (if it contains paragraph breaks)
        const paragraphs = content.split('\n\n').filter(p => p.trim());
        
        // If no explicit paragraphs, try to split intelligently
        if (paragraphs.length <= 1) {
            const sentences = content.split('. ');
            const totalSentences = sentences.length;
            const sentencesPerParagraph = Math.ceil(totalSentences / 2); // Aim for 2 paragraphs
            
            for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
                const paragraph = document.createElement('p');
                paragraph.textContent = sentences.slice(i, i + sentencesPerParagraph).join('. ').trim() + '.';
                contentElement.appendChild(paragraph);
            }
        } else {
            // Use existing paragraph breaks
            paragraphs.forEach(p => {
                const paragraph = document.createElement('p');
                paragraph.textContent = p.trim();
                contentElement.appendChild(paragraph);
            });
        }
        
        newContentSection.appendChild(contentElement);
        
        // Add a separator
        const separator = document.createElement('div');
        separator.className = 'content-separator';
        newContentSection.appendChild(separator);
        
        // Insert at the beginning of content area
        contentArea.insertBefore(newContentSection, contentArea.firstChild);
        
        // Hide the default content text if it exists
        contentText.style.display = 'none';
        
        // Hide the panel indicator after first content is shown
        const panelIndicator = document.querySelector('.panel-indicator');
        if (panelIndicator) {
            panelIndicator.style.display = 'none';
        }
        
        // Ensure the panel is always visible
        contentPanel.classList.add('active');
        
        // Log for debugging
        console.log("Showing content for:", displayTitle);
    }

    // Function to show a loading placeholder
    function showLoadingContent(title) {
        // Create a new content section
        const loadingSection = document.createElement('div');
        loadingSection.className = 'content-section loading-section';
        loadingSection.id = 'loading-content-section';
        
        // Add title
        const titleElement = document.createElement('h3');
        titleElement.className = 'content-title';
        titleElement.textContent = title;
        loadingSection.appendChild(titleElement);
        
        // Add loading indicator
        const loadingElement = document.createElement('div');
        loadingElement.className = 'content-text loading-text';
        
        // Create a paragraph for the loading text
        const loadingParagraph = document.createElement('p');
        loadingParagraph.textContent = 'Loading...';
        loadingElement.appendChild(loadingParagraph);
        
        loadingSection.appendChild(loadingElement);
        
        // Add a separator
        const separator = document.createElement('div');
        separator.className = 'content-separator';
        loadingSection.appendChild(separator);
        
        // Insert at the beginning of content area
        contentArea.insertBefore(loadingSection, contentArea.firstChild);
        
        // Hide the default content text if it exists
        contentText.style.display = 'none';
        
        // Hide the panel indicator after first content is shown
        const panelIndicator = document.querySelector('.panel-indicator');
        if (panelIndicator) {
            panelIndicator.style.display = 'none';
        }
    }
    
    // Function to remove the loading section
    function removeLoadingContent() {
        const loadingSection = document.getElementById('loading-content-section');
        if (loadingSection) {
            loadingSection.remove();
        }
    }

    // Function to get the context path for a node (all ancestors)
    function getNodeContextPath(nodeId) {
        const contextPath = [];
        let currentNodeId = nodeId;
        
        // Find all connected edges to this node
        const connectedEdges = network.getConnectedEdges(currentNodeId);
        
        // For each edge, check if it connects to a parent node
        for (let edgeId of connectedEdges) {
            const edge = edges.get(edgeId);
            
            // If this edge connects to the current node as a target, the source is the parent
            if (edge.to === currentNodeId) {
                const parentNodeId = edge.from;
                const parentNode = nodes.get(parentNodeId);
                
                // Add parent to the beginning of the path
                if (parentNode) {
                    contextPath.unshift({
                        id: parentNodeId,
                        label: parentNode.label
                    });
                    
                    // Recursively get parents of this parent
                    const parentPath = getNodeContextPath(parentNodeId);
                    
                    // Add all ancestors to the beginning of the path
                    contextPath.unshift(...parentPath);
                    
                    // We only need one parent (assuming tree structure, not graph)
                    break;
                }
            }
        }
        
        return contextPath;
    }

    // Function to expand a node with subtopics
    function expandNode(node, subtopics, parentTopic, contextPath, isAdditional = false) {
        // Mark the node as expanded if it's the first expansion
        if (!isAdditional) {
            nodes.update({
                id: node.id,
                expanded: true
            });
        }

        // Calculate distribution angle for positioning
        const totalNodes = subtopics.length;
        const baseAngle = isAdditional ? (2 * Math.PI / totalNodes) : (Math.PI / (totalNodes + 1));
        
        // Get existing connected nodes to avoid their positions
        const connectedNodes = network.getConnectedNodes(node.id);
        const existingPositions = [];
        
        if (connectedNodes.length > 0) {
            connectedNodes.forEach(connectedId => {
                const connectedNodePosition = network.getPositions([connectedId])[connectedId];
                if (connectedNodePosition) {
                    existingPositions.push(connectedNodePosition);
                }
            });
        }
        
        // Get the current node's position
        const nodePosition = network.getPositions([node.id])[node.id];
        
        // Only proceed with positioning if we have the parent position
        if (nodePosition) {
            // Add child nodes with distributed positions
            subtopics.forEach((topic, index) => {
                const childId = nodeIdCounter++;
                
                // Limit the topic length to 2-4 words
                const limitedTopic = limitTopicLength(topic);
                const needsTooltip = limitedTopic !== topic;
                
                // Create a new context path for this child
                const childContextPath = [...contextPath, {
                    id: node.id,
                    label: parentTopic
                }];
                
                // Set different colors for additional topics
                let nodeColor, nodeTextColor, nodeBorder;
                
                if (isAdditional) {
                    // For additional expansions, use a different color theme
                    const expansionColors = [
                        { bg: '#FF9800', border: '#E65100', text: 'white' },  // Orange (1st additional set)
                        { bg: '#4CAF50', border: '#2E7D32', text: 'white' },  // Green (2nd additional set)
                        { bg: '#F44336', border: '#B71C1C', text: 'white' },  // Red (3rd additional set)
                        { bg: '#9C27B0', border: '#6A1B9A', text: 'white' },  // Purple (4th additional set)
                    ];
                    
                    // Get the appropriate color based on expandCount (fallback to first color if too many expansions)
                    const expandCount = (node.expandCount || 1) - 1;
                    const colorIndex = Math.min(expandCount, expansionColors.length - 1);
                    
                    nodeColor = expansionColors[colorIndex].bg;
                    nodeBorder = expansionColors[colorIndex].border;
                    nodeTextColor = expansionColors[colorIndex].text;
                } else {
                    // Default colors for initial expansion
                    nodeColor = 'white';
                    nodeBorder = '#2B7CE9';
                    nodeTextColor = '#343434';
                }
                
                // Calculate position for the new node
                // Start with angle based on index and adjust based on existing nodes
                let angle = baseAngle * (index + 1);
                
                // For additional expansions, offset the angle to avoid overlap
                if (isAdditional) {
                    // Offset angles by expandCount to avoid overlapping with previous expansions
                    const expandCount = (node.expandCount || 1) - 1;
                    angle += (Math.PI / 6) * expandCount;
                }
                
                // Calculate distance based on network size and number of existing nodes
                const distance = 150 + (connectedNodes.length * 10);
                
                // Calculate position
                let x = nodePosition.x + distance * Math.cos(angle);
                let y = nodePosition.y + distance * Math.sin(angle);
                
                // Check for potential overlaps with existing nodes
                let positionIsGood = true;
                const minDistance = 100; // Minimum distance between nodes
                
                for (const pos of existingPositions) {
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist < minDistance) {
                        positionIsGood = false;
                        break;
                    }
                }
                
                // If position overlaps, find a better position
                if (!positionIsGood) {
                    // Try increasing the distance
                    for (let adjustedDistance = distance + 50; adjustedDistance <= distance + 200; adjustedDistance += 50) {
                        const newX = nodePosition.x + adjustedDistance * Math.cos(angle);
                        const newY = nodePosition.y + adjustedDistance * Math.sin(angle);
                        
                        let newPositionIsGood = true;
                        for (const pos of existingPositions) {
                            const dx = newX - pos.x;
                            const dy = newY - pos.y;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            
                            if (dist < minDistance) {
                                newPositionIsGood = false;
                                break;
                            }
                        }
                        
                        if (newPositionIsGood) {
                            // Found a good position
                            x = newX;
                            y = newY;
                            positionIsGood = true;
                            break;
                        }
                    }
                }
                
                // Add the node
                nodes.add({
                    id: childId,
                    label: limitedTopic,
                    expanded: false,
                    contextPath: childContextPath,
                    parentTopic: parentTopic,
                    fullTopic: topic, // Store the full topic text for the content panel
                    title: needsTooltip ? topic : undefined, // Add tooltip for truncated topics
                    additionalSet: isAdditional ? (node.expandCount || 1) : 0,
                    color: {
                        background: nodeColor,
                        border: nodeBorder
                    },
                    font: {
                        color: nodeTextColor
                    },
                    x: x,
                    y: y,
                    fixed: {
                        x: false,
                        y: false
                    }
                });
                
                // Add position to existing positions to avoid future overlaps
                existingPositions.push({x, y});
                
                // Connect to parent
                edges.add({
                    from: node.id,
                    to: childId,
                    color: isAdditional ? nodeBorder : undefined
                });
            });
        } else {
            // Fallback if we can't get parent position
            // Add child nodes without positioning
            subtopics.forEach((topic, index) => {
                const childId = nodeIdCounter++;
                
                // Limit the topic length to 2-4 words
                const limitedTopic = limitTopicLength(topic);
                const needsTooltip = limitedTopic !== topic;
                
                // Create a new context path for this child
                const childContextPath = [...contextPath, {
                    id: node.id,
                    label: parentTopic
                }];
                
                // Set colors as before
                let nodeColor, nodeTextColor, nodeBorder;
                
                if (isAdditional) {
                    const expansionColors = [
                        { bg: '#FF9800', border: '#E65100', text: 'white' },
                        { bg: '#4CAF50', border: '#2E7D32', text: 'white' },
                        { bg: '#F44336', border: '#B71C1C', text: 'white' },
                        { bg: '#9C27B0', border: '#6A1B9A', text: 'white' }
                    ];
                    
                    const expandCount = (node.expandCount || 1) - 1;
                    const colorIndex = Math.min(expandCount, expansionColors.length - 1);
                    
                    nodeColor = expansionColors[colorIndex].bg;
                    nodeBorder = expansionColors[colorIndex].border;
                    nodeTextColor = expansionColors[colorIndex].text;
                } else {
                    nodeColor = 'white';
                    nodeBorder = '#2B7CE9';
                    nodeTextColor = '#343434';
                }
                
                // Add the node without positioning
                nodes.add({
                    id: childId,
                    label: limitedTopic,
                    expanded: false,
                    contextPath: childContextPath,
                    parentTopic: parentTopic,
                    fullTopic: topic,
                    title: needsTooltip ? topic : undefined,
                    additionalSet: isAdditional ? (node.expandCount || 1) : 0,
                    color: {
                        background: nodeColor,
                        border: nodeBorder
                    },
                    font: {
                        color: nodeTextColor
                    }
                });
                
                // Connect to parent
                edges.add({
                    from: node.id,
                    to: childId,
                    color: isAdditional ? nodeBorder : undefined
                });
            });
        }
        
        // Ensure proper layout after adding nodes
        if (network) {
            setTimeout(() => {
                // Re-highlight the current path
                highlightPathToNode(node.id, '#9c27b0');
                
                // Get all connected nodes for this node
                const connectedNodes = network.getConnectedNodes(node.id);
                const nodesToShow = [node.id, ...connectedNodes];
                
                // Enable physics briefly to settle the nodes
                network.setOptions({ 
                    physics: { 
                        enabled: true,
                        stabilization: {
                            iterations: 100
                        },
                        barnesHut: {
                            gravitationalConstant: -2000,
                            centralGravity: 0.1,
                            springLength: 200,
                            springConstant: 0.04,
                            damping: 0.09,
                            avoidOverlap: 1
                        },
                        timestep: 0.5
                    }
                });
                
                // Fit to show the node and its connections while maintaining zoom level
                network.fit({
                    nodes: nodesToShow,
                    animation: {
                        duration: 1000,
                        easingFunction: 'easeOutQuint'
                    },
                    scale: 0.8  // Maintain consistent zoom level
                });
                
                // Keep gentle physics
                setTimeout(() => {
                    network.setOptions({ 
                        physics: { 
                            enabled: true,
                            barnesHut: {
                                gravitationalConstant: -2000,
                                centralGravity: 0.1,
                                springLength: 200,
                                springConstant: 0.04,
                                damping: 0.09,
                                avoidOverlap: 1
                            },
                            timestep: 0.5
                        }
                    });
                }, 1000);
            }, 100);
        }
    }

    // Function to fetch content and subtopics from the server
    async function fetchNodeContent(topic, contextPath, expandCount = 1) {
        // Convert context path to a string of topics
        const contextString = contextPath.map(node => node.label).join('|');
        
        const response = await fetch('index.php?action=get_content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'topic=' + encodeURIComponent(topic) + 
                  '&context=' + encodeURIComponent(contextString) +
                  '&expandCount=' + encodeURIComponent(expandCount)
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        return response.json();
    }

    // Function to create the initial mind map
    async function createMindMap(mainTopic) {
        // Clear existing data
        nodes.clear();
        edges.clear();
        nodeIdCounter = 1;
        
        // Show loading indicator
        showLoading();
        
        // Show the loading content in the sidebar
        showLoadingContent(mainTopic);
        
        try {
            const response = await fetch('index.php?action=create_mindmap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'topic=' + encodeURIComponent(mainTopic)
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();
            
            // Limit the main topic if it's too long
            const limitedMainTopic = limitTopicLength(mainTopic);
            const needsTooltip = limitedMainTopic !== mainTopic;
            
            // Get container dimensions
            const containerWidth = mindmapContainer.clientWidth;
            const containerHeight = mindmapContainer.clientHeight;
            
            // Create the main node at the center
            nodes.add({
                id: nodeIdCounter++,
                label: limitedMainTopic,
                expanded: true,
                content: data.content,
                contextPath: [], // Root node has empty context path
                fullTopic: mainTopic, // Store the full topic name
                title: needsTooltip ? mainTopic : undefined, // Add tooltip if needed
                color: {
                    background: '#3498db',
                    border: '#2980b9'
                },
                font: {
                    color: 'white'
                },
                x: containerWidth / 2,
                y: containerHeight / 2,
                fixed: {
                    x: false,
                    y: false
                },
                size: 30 // Make the main node slightly larger
            });
            
            // Position initial topics in a circle around the main node
            const initialPositions = calculateInitialPositions(
                containerWidth / 2, 
                containerHeight / 2, 
                data.subtopics.length,
                200 // Initial radius
            );
            
            // Add the initial subtopics with predefined positions
            data.subtopics.forEach((topic, index) => {
                const childId = nodeIdCounter++;
                
                // Limit the topic length to 2-4 words
                const limitedTopic = limitTopicLength(topic);
                const needsTooltip = limitedTopic !== topic;
                
                // Add the node with predetermined position
                nodes.add({
                    id: childId,
                    label: limitedTopic,
                    expanded: false,
                    contextPath: [{ id: 1, label: mainTopic }],
                    parentTopic: mainTopic,
                    fullTopic: topic,
                    title: needsTooltip ? topic : undefined,
                    color: {
                        background: 'white',
                        border: '#2B7CE9'
                    },
                    font: {
                        color: '#343434'
                    },
                    x: initialPositions[index].x,
                    y: initialPositions[index].y
                });
                
                // Connect to main node
                edges.add({
                    from: 1,
                    to: childId
                });
            });
            
            // Remove loading indicator from sidebar
            removeLoadingContent();
            
            // Show the main topic content using the same format as node clicks
            showContentPanel(mainTopic, data.content);
            
            // Ensure the network fits the container
            setTimeout(() => {
                if (network) {
                    // Highlight the main node
                    const mainNodeId = 1;
                    network.selectNodes([mainNodeId]);
                    
                    // Enable physics briefly to settle the nodes
                    network.setOptions({ 
                        physics: { 
                            enabled: true,
                            stabilization: {
                                iterations: 100
                            },
                            barnesHut: {
                                gravitationalConstant: -2000,
                                centralGravity: 0.1,
                                springLength: 200,
                                springConstant: 0.04,
                                damping: 0.09,
                                avoidOverlap: 1
                            },
                            timestep: 0.5
                        }
                    });
                    
                    // Fit after physics stabilization with the same zoom level as topic clicks
                    setTimeout(() => {
                        network.fit({
                            animation: {
                                duration: 1000,
                                easingFunction: 'easeOutQuint'
                            },
                            scale: 0.8  // Match the zoom level used when clicking topics
                        });
                        
                        // Keep gentle physics instead of disabling
                        setTimeout(() => {
                            network.setOptions({ 
                                physics: { 
                                    enabled: true,
                                    barnesHut: {
                                        gravitationalConstant: -2000,
                                        centralGravity: 0.1,
                                        springLength: 200,
                                        springConstant: 0.04,
                                        damping: 0.09,
                                        avoidOverlap: 1
                                    },
                                    timestep: 0.5
                                }
                            });
                        }, 1000);
                    }, 500);
                }
            }, 100);
            
        } catch (error) {
            console.error('Error:', error);
            alert('Error creating mind map. Please try again.');
            
            // Remove loading content on error
            removeLoadingContent();
            
            // Show error in content panel
            showContentPanel(mainTopic, 'Error creating mind map. Please try again.');
        } finally {
            hideLoading();
        }
    }

    // Helper function to calculate evenly distributed positions in a circle
    function calculateInitialPositions(centerX, centerY, count, radius) {
        const positions = [];
        const angleStep = (2 * Math.PI) / count;
        
        for (let i = 0; i < count; i++) {
            // Calculate position based on angle, adding some randomness to radius
            const angle = i * angleStep;
            const adjustedRadius = radius * (0.9 + Math.random() * 0.2); // Random variation of 90-110% of radius
            const x = centerX + adjustedRadius * Math.cos(angle);
            const y = centerY + adjustedRadius * Math.sin(angle);
            
            positions.push({ x, y });
        }
        
        return positions;
    }

    // Event listeners
    submitBtn.addEventListener('click', function() {
        const topic = topicInput.value.trim();
        if (topic) {
            // No longer hiding the welcome title
            // const existingTitles = document.querySelectorAll('.initial-content .content-title');
            // existingTitles.forEach(title => {
            //     title.style.display = 'none';
            // });
            
            createMindMap(topic);
        } else {
            alert('Please enter a topic.');
        }
    });

    topicInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });

    closePanel.addEventListener('click', function() {
        contentPanel.classList.remove('active');
    });

    // Hide the close panel button since we always want the sidebar visible
    closePanel.style.display = 'none';

    // Initialize the network
    initNetwork();
}); 