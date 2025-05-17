<?php
	// verification.php - Entry point for human verification
	session_start();

	// If already verified, redirect to the main application
	if (isset($_SESSION['is_human_verified']) && $_SESSION['is_human_verified'] === true) {
		header('Location: index.php');
		exit;
	}

	require __DIR__ . '/vendor/autoload.php';
	use Dotenv\Dotenv;

	// Load environment variables
	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

	$verificationError = '';

	// Handle form submission
	if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['g-recaptcha-response'])) {
		$recaptchaToken = $_POST['g-recaptcha-response'];
		$secretKey = $_ENV['RECAPTCHA_V2_CHECKBOX_SECRET_KEY'] ?? '';

		if (empty($secretKey)) {
			$verificationError = 'Verification system is not properly configured. Please contact the administrator.';
		} elseif (empty($recaptchaToken)) {
			$verificationError = 'Please complete the captcha verification.';
		} else {
			// Verify the token
			$client = new GuzzleHttp\Client();
			try {
				$response = $client->post('https://www.google.com/recaptcha/api/siteverify', [
					'form_params' => [
						'secret' => $secretKey,
						'response' => $recaptchaToken,
						'remoteip' => $_SERVER['REMOTE_ADDR'] ?? null
					]
				]);

				$body = json_decode((string)$response->getBody(), true);

				if ($body && isset($body['success']) && $body['success'] === true) {
					// Verification successful, set session and redirect
					$_SESSION['is_human_verified'] = true;
					// Also set the TTS verification since we're verifying the user globally
					$_SESSION['recaptcha_tts_verified'] = true;

					header('Location: index.php');
					exit;
				} else {
					$verificationError = 'Verification failed. Please try again.';
					if (isset($body['error-codes'])) {
						error_log('reCAPTCHA verification failed: ' . implode(', ', $body['error-codes']));
					}
				}
			} catch (Exception $e) {
				$verificationError = 'An error occurred during verification. Please try again later.';
				error_log('reCAPTCHA verification exception: ' . $e->getMessage());
			}
		}
	}
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="<?php echo isset($_COOKIE['theme']) && $_COOKIE['theme'] === 'dark' ? 'dark' : 'light'; ?>">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Human Verification - Read Out Slowly</title>
	<link rel="stylesheet" href="public/vendor/bootstrap5.3.5/css/bootstrap.min.css">
	<link rel="stylesheet" href="public/vendor/fontawesome-free-6.7.2/css/all.min.css">
	<script src="https://www.google.com/recaptcha/api.js" async defer></script>
</head>
<body>
<div class="container mt-5">
	<div class="row justify-content-center">
		<div class="col-md-8">
			<div class="card">
				<div class="card-header">
					<h3 class="text-center">Human Verification</h3>
				</div>
				<div class="card-body">
					<p class="text-center">
						To use Read Out Slowly, please verify that you're human.
						This verification will allow you to use all features including text-to-speech.
					</p>

					<?php if ($verificationError): ?>
						<div class="alert alert-danger"><?php echo htmlspecialchars($verificationError); ?></div>
					<?php endif; ?>

					<form method="POST" class="text-center">
						<div class="mb-4 d-flex justify-content-center">
							<div class="g-recaptcha" data-sitekey="<?php echo htmlspecialchars($_ENV['RECAPTCHA_V2_CHECKBOX_SITE_KEY'] ?? ''); ?>"></div>
						</div>

						<button type="submit" class="btn btn-primary btn-lg">
							<i class="fas fa-check-circle"></i> Verify and Continue
						</button>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>

<script src="public/vendor/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="public/js/dark-mode.js"></script>
</body>
</html>
