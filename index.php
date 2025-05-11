<?php

	require __DIR__ . '/vendor/autoload.php';

	use App\Helpers\SimplifiedLlmAudioHelper;
	use Dotenv\Dotenv;

// Load environment variables from .env file
	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

// --- Configuration for the Helper ---
// These paths are relative to this index.php script
	$config = [
		'log_directory' => __DIR__ . '/' . (SimplifiedLlmAudioHelper::getEnvVar('LOG_DIRECTORY') ?: 'storage/logs'),
		'public_storage_path' => __DIR__ . '/' . (SimplifiedLlmAudioHelper::getEnvVar('PUBLIC_STORAGE_PATH') ?: 'public'),
		'app_url' => SimplifiedLlmAudioHelper::getEnvVar('APP_URL') ?: 'http://localhost:8000',
		'ffmpeg_path' => SimplifiedLlmAudioHelper::getEnvVar('FFMPEG_PATH') ?: 'ffmpeg'
	];

// Initialize the helper (and its logger)
	SimplifiedLlmAudioHelper::init($config);

	echo "<pre>"; // For nice browser output

// --- Example 1: Send text to LLM ---
	echo "--- Testing LLM Call ---\n";
	$llmModel = getenv('DEFAULT_LLM_FOR_SIMPLE_HELPER') ?: 'mistralai/mistral-7b-instruct';
	$systemPrompt = "You are a helpful assistant.";
	$userPrompt = "What is the capital of France?";

	$llmResponse = SimplifiedLlmAudioHelper::sendTextToLlm($llmModel, $systemPrompt, $userPrompt);

	if ($llmResponse['success']) {
		echo "LLM Response Content: " . htmlspecialchars($llmResponse['content']) . "\n";
		echo "Prompt Tokens: " . $llmResponse['prompt_tokens'] . "\n";
		echo "Completion Tokens: " . $llmResponse['completion_tokens'] . "\n";
	} else {
		echo "LLM Error: " . htmlspecialchars($llmResponse['error']) . "\n";
	}
	echo "\n\n";


// --- Example 2: Text to Speech with OpenAI ---
	echo "--- Testing OpenAI TTS Call ---\n";
	$textToSpeak = "Hello from the standalone PHP script! This audio has been amplified using our simple logger.";
	$voice = 'nova';
	$filenameBase = "my_simple_log_audio_" . time();
	$volume = 3.0;

	$ttsResponse = SimplifiedLlmAudioHelper::textToSpeechOpenAI($textToSpeak, $voice, $filenameBase, $volume);

	if ($ttsResponse['success']) {
		echo "TTS Success!\n";
		echo "Message: " . htmlspecialchars($ttsResponse['message']) . "\n";
		echo "Storage Path (relative to public_storage_path): " . htmlspecialchars($ttsResponse['storage_path']) . "\n";
		echo "Full File URL: " . htmlspecialchars($ttsResponse['fileUrl']) . "\n";
		echo "You can try accessing the audio file: <a href='" . htmlspecialchars($ttsResponse['fileUrl']) . "' target='_blank'>Play Audio</a>\n";
	} else {
		echo "TTS Error: " . htmlspecialchars($ttsResponse['message']) . "\n";
	}

	echo "</pre>";

?>
