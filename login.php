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

	$loginError = '';

	if ($_SERVER['REQUEST_METHOD'] === 'POST') {
		$username = $_POST['username'] ?? '';
		$password = $_POST['password'] ?? '';

		if (empty($username) || empty($password)) {
			$loginError = 'Please enter both username and password.';
		} else {
			if (AuthHelper::loginUser($username, $password)) {
				header('Location: index.php');
				exit;
			} else {
				$loginError = 'Invalid username or password.';
			}
		}
	}
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="<?php echo isset($_COOKIE['theme']) && $_COOKIE['theme'] === 'dark' ? 'dark' : 'light'; ?>">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Login - Read Out Slowly</title>
	<link rel="stylesheet" href="public/vendor/bootstrap5.3.5/css/bootstrap.min.css">
	<link rel="stylesheet" href="public/vendor/fontawesome-free-6.7.2/css/all.min.css">
</head>
<body>
<div class="container mt-5">
	<div class="row justify-content-center">
		<div class="col-md-6 col-lg-5">
			<div class="card">
				<div class="card-header">
					<h3 class="text-center">Login</h3>
				</div>
				<div class="card-body">
					<?php if ($loginError): ?>
						<div class="alert alert-danger"><?php echo htmlspecialchars($loginError); ?></div>
					<?php endif; ?>
					<form method="POST">
						<div class="mb-3">
							<label for="username" class="form-label"><i class="fas fa-user"></i> Username</label>
							<input type="text" class="form-control" id="username" name="username" required>
						</div>
						<div class="mb-3">
							<label for="password" class="form-label"><i class="fas fa-lock"></i> Password</label>
							<input type="password" class="form-control" id="password" name="password" required>
						</div>
						<div class="d-grid">
							<button type="submit" class="btn btn-primary btn-lg">
								<i class="fas fa-sign-in-alt"></i> Login
							</button>
						</div>
					</form>
					<hr>
					<div class="text-center">
						<p>Don't have an account? <a href="signup.php">Sign up here</a></p>
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
