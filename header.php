<?php
	session_start(); // Ensure session is started at the very beginning
	error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);

	require __DIR__ . '/vendor/autoload.php';

	use App\Helpers\SimplifiedLlmAudioHelper;
	use App\Helpers\AuthHelper;
	use App\Helpers\Database;
	use Dotenv\Dotenv;

// Load environment variables from .env file
	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

// Initialize Database connection
	Database::getConnection();

// Check if user is logged in. If not, redirect to login page.
// This protects all pages that include this header.
	if (!AuthHelper::isLoggedIn()) {
		// For AJAX requests, return an authentication error
		if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
			header('Content-Type: application/json');
			// Use a 401 Unauthorized status code
			http_response_code(401);
			echo json_encode([
				'success' => false,
				'message' => 'Authentication required. Please login again.',
				'require_verification' => true // This can trigger a page reload on the client
			]);
			exit;
		}
		// For regular page loads, redirect to the login page
		header('Location: login.php');
		exit;
	}

// --- Configuration for the Helper ---
	$config = [
		'log_directory' => __DIR__ . '/' . ($_ENV['LOG_DIRECTORY'] ?? 'storage/logs'),
		'public_storage_path' => __DIR__ . '/' . ($_ENV['PUBLIC_STORAGE_PATH_BASEDIR'] ?? 'public'),
		'public_url_segment' => $_ENV['PUBLIC_STORAGE_PATH_SEGMENT'] ?? 'public',
		'app_url' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
		'ffmpeg_path' => $_ENV['FFMPEG_PATH'] ?? 'ffmpeg'
	];
	SimplifiedLlmAudioHelper::init($config);

