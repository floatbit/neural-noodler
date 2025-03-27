# Interactive Mind Map

A single-page PHP application that creates interactive mind maps based on user input topics. The application uses OpenAI's GPT API to generate related subtopics and content.

## Features

- Enter a topic to generate a mind map
- Interactive visualization with vis.js
- Expandable nodes with content and subtopics
- Recursive topic exploration
- Content panel for detailed information

## Requirements

- PHP 8.1 or higher
- Composer for dependency management
- OpenAI API key

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd mindmap
   ```

2. Install dependencies:
   ```
   composer install
   ```

3. Create a `.env` file in the root directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

4. Start a PHP server:
   ```
   php -S localhost:8000
   ```

5. Open your browser and navigate to `http://localhost:8000`

## Usage

1. Enter a topic in the input field (e.g., "The Matrix")
2. Click "Generate Mind Map" or press Enter
3. The main topic will appear with 3-4 subtopics
4. Click on any subtopic to see its content and further subtopics
5. Continue exploring the mind map by clicking on nodes

## Technologies Used

- PHP for backend processing
- OpenAI API for content generation
- vis.js for mind map visualization
- HTML, CSS, and JavaScript for the frontend interface

## Future Enhancements

- User authentication
- Saving mind maps to a database
- Customizable appearance
- Exporting mind maps as images or PDFs
- Sharing functionality 