<?php

	namespace App\Helpers;

	use mysqli_sql_exception;

	class AuthHelper
	{

		public static function registerUser(string $username, string $email, string $password): array
		{
			$mysqli = Database::getConnection();
			if (!$mysqli) {
				return ['success' => false, 'message' => 'Database connection failed.'];
			}

			try {
				// Check if username or email already exists
				$stmt = $mysqli->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
				$stmt->bind_param("ss", $username, $email);
				$stmt->execute();
				$stmt->store_result(); // Required to check num_rows

				if ($stmt->num_rows > 0) {
					$stmt->close();
					return ['success' => false, 'message' => 'Username or email already taken.'];
				}
				$stmt->close();

				// Hash the password
				$password_hash = password_hash($password, PASSWORD_DEFAULT);

				// Insert the new user
				$stmt = $mysqli->prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)");
				$stmt->bind_param("sss", $username, $email, $password_hash);
				$stmt->execute();

				if ($stmt->affected_rows > 0) {
					$stmt->close();
					return ['success' => true, 'message' => 'Registration successful.'];
				} else {
					$stmt->close();
					return ['success' => false, 'message' => 'Registration failed, no rows were inserted.'];
				}

			} catch (mysqli_sql_exception $e) {
				SimplifiedLlmAudioHelper::log('ERROR', 'User registration failed.', ['error' => $e->getMessage()]);
				return ['success' => false, 'message' => 'An error occurred during registration.'];
			}
		}

		public static function loginUser(string $username, string $password): bool
		{
			$mysqli = Database::getConnection();
			if (!$mysqli) {
				return false;
			}

			try {
				$stmt = $mysqli->prepare("SELECT id, username, password_hash FROM users WHERE username = ?");
				$stmt->bind_param("s", $username);
				$stmt->execute();
				$result = $stmt->get_result();
				$user = $result->fetch_assoc();
				$stmt->close();

				if ($user && password_verify($password, $user['password_hash'])) {
					// Regenerate session ID to prevent session fixation
					session_regenerate_id(true);
					$_SESSION['user_id'] = $user['id'];
					$_SESSION['username'] = $user['username'];
					return true;
				}
			} catch (mysqli_sql_exception $e) {
				SimplifiedLlmAudioHelper::log('ERROR', 'User login failed.', ['error' => $e->getMessage()]);
				return false;
			}

			return false;
		}

		public static function isLoggedIn(): bool
		{
			return isset($_SESSION['user_id']);
		}

		public static function logoutUser(): void
		{
			$_SESSION = [];

			if (ini_get("session.use_cookies")) {
				$params = session_get_cookie_params();
				setcookie(session_name(), '', time() - 42000,
					$params["path"], $params["domain"],
					$params["secure"], $params["httponly"]
				);
			}

			session_destroy();
		}

		public static function getCurrentUsername(): ?string
		{
			return $_SESSION['username'] ?? null;
		}
	}
