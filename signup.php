<?php
	session_start();
	require __DIR__ . '/vendor/autoload.php';

	use App\Helpers\AuthHelper;
	use Dotenv\Dotenv;

	// Load environment variables
	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

	// If user is already logged in, redirect to index
	if (AuthHelper::isLoggedIn()) {
		header('Location: index.php');
		exit;
	}

	// Check if human verification is done. If not, redirect to verification.
	if (!isset($_SESSION['is_human_verified']) || $_SESSION['is_human_verified'] !== true) {
		header('Location: verification.php');
		exit;
	}

	$signupError = '';
	$signupSuccess = '';

	if ($_SERVER['REQUEST_METHOD'] === 'POST') {
		$username = $_POST['username'] ?? '';
		$email = $_POST['email'] ?? '';
		$password = $_POST['password'] ?? '';
		$confirm_password = $_POST['confirm_password'] ?? '';

		if (empty($username) || empty($email) || empty($password)) {
			$signupError = 'All fields are required.';
		} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
			$signupError = 'Invalid email format.';
		} elseif (strlen($password) < 8) {
			$signupError = 'Password must be at least 8 characters long.';
		} elseif ($password !== $confirm_password) {
			$signupError = 'Passwords do not match.';
		} else {
			$result = AuthHelper::registerUser($username, $email, $password);
			if ($result['success']) {
				$signupSuccess = $result['message'] . ' You can now <a href="login.php">login</a>.';
			} else {
				$signupError = $result['message'];
			}
		}
	}
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="<?php echo isset($_COOKIE['theme']) && $_COOKIE['theme'] === 'dark' ? 'dark' : 'light'; ?>">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Sign Up - Read Out Slowly</title>
	<link rel="stylesheet" href="public/vendor/bootstrap5.3.5/css/bootstrap.min.css">
	<link rel="stylesheet" href="public/vendor/fontawesome-free-6.7.2/css/all.min.css">
</head>
<body>
<div class="container mt-5">
	<div class="row justify-content-center">
		<div class="col-md-6 col-lg-5">
			<div class="card">
				<div class="card-header">
					<h3 class="text-center">Sign Up</h3>
				</div>
				<div class="card-body">
					<?php if ($signupError): ?>
						<div class="alert alert-danger"><?php echo htmlspecialchars($signupError); ?></div>
					<?php endif; ?>
					<?php if ($signupSuccess): ?>
						<div class="alert alert-success"><?php echo $signupSuccess; // Allows link ?></div>
					<?php endif; ?>
					<form method="POST">
						<div class="mb-3">
							<label for="username" class="form-label"><i class="fas fa-user"></i> Username</label>
							<input type="text" class="form-control" id="username" name="username" required value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>">
						</div>
						<div class="mb-3">
							<label for="email" class="form-label"><i class="fas fa-envelope"></i> Email</label>
							<input type="email" class="form-control" id="email" name="email" required value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>">
						</div>
						<div class="mb-3">
							<label for="password" class="form-label"><i class="fas fa-lock"></i> Password</label>
							<input type="password" class="form-control" id="password" name="password" required>
							<div class="form-text">Must be at least 8 characters long.</div>
						</div>
						<div class="mb-3">
							<label for="confirm_password" class="form-label"><i class="fas fa-lock"></i> Confirm Password</label>
							<input type="password" class="form-control" id="confirm_password" name="confirm_password" required>
						</div>
						<div class="d-grid">
							<button type="submit" class="btn btn-primary btn-lg">
								<i class="fas fa-user-plus"></i> Sign Up
							</button>
						</div>
					</form>
					<hr>
					<div class="text-center">
						<p>Already have an account? <a href="login.php">Login here</a></p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
<script src="public/vendor/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="public/js/dark-mode.js"></script>
</body>
</html>
