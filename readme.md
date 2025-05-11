To Run the Example:


Make sure you have PHP, Composer, and ffmpeg installed.

Navigate to your-project/ in your terminal.

Run composer install.

Copy your API keys into the .env file.

Adjust paths in .env if needed (especially FFMPEG_PATH if it's not in your system's PATH).

Ensure the public/tts/openai/ and storage/logs/ directories are writable by your web server or PHP process.

You can run the index.php script from the command line: php index.php

Or, if you have a local web server (like PHP's built-in server), you can serve it:

cd your-project/

php -S localhost:8000 index.php

Then open http://localhost:8000 in your browser. The generated audio file link should work.

This setup provides a standalone version of your helper class with logging, environment variable management, and the core functionalities you requested.
