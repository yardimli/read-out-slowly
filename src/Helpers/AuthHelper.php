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

		// --- NEW METHODS FOR USER DATA ---

		public static function getSettings(int $userId): ?array {
			$mysqli = Database::getConnection();
			$stmt = $mysqli->prepare("SELECT settings FROM users WHERE id = ?");
			$stmt->bind_param("i", $userId);
			$stmt->execute();
			$result = $stmt->get_result();
			$row = $result->fetch_assoc();
			$stmt->close();
			if ($row && $row['settings']) {
				return json_decode($row['settings'], true);
			}
			return []; // Return empty array if no settings
		}

		public static function updateSetting(int $userId, string $key, $value): bool {
			$mysqli = Database::getConnection();
			// Using JSON_SET to safely insert or update a key in the JSON object
			// The path `$.key` is how you specify the key to update.
			$stmt = $mysqli->prepare("UPDATE users SET settings = JSON_SET(COALESCE(settings, '{}'), ?, ?) WHERE id = ?");
			$jsonPath = '$.' . $key;

			// THE FIX IS HERE: Remove json_encode(). Pass the raw value.
			// MySQL's JSON_SET will correctly handle string, int, float, and bool types.
			$stmt->bind_param("ssi", $jsonPath, $value, $userId);

			$success = $stmt->execute();
			$stmt->close();
			return $success;
		}

		public static function getTexts(int $userId): array
		{
			$mysqli = Database::getConnection();
			$stmt = $mysqli->prepare("SELECT id, name, text, created_at FROM user_texts WHERE user_id = ? ORDER BY created_at DESC");
			$stmt->bind_param("i", $userId);
			$stmt->execute();
			$result = $stmt->get_result();
			$texts = $result->fetch_all(MYSQLI_ASSOC);
			$stmt->close();
			return $texts;
		}

		public static function saveText(int $userId, string $name, string $text): ?int
		{
			$mysqli = Database::getConnection();
			$stmt = $mysqli->prepare("INSERT INTO user_texts (user_id, name, text) VALUES (?, ?, ?)");
			$stmt->bind_param("iss", $userId, $name, $text);
			if ($stmt->execute()) {
				$newId = $stmt->insert_id;
				$stmt->close();
				return $newId;
			}
			$stmt->close();
			return null;
		}

		public static function deleteText(int $userId, int $textId): bool
		{
			$mysqli = Database::getConnection();
			// Ensure the text belongs to the user before deleting
			$stmt = $mysqli->prepare("DELETE FROM user_texts WHERE id = ? AND user_id = ?");
			$stmt->bind_param("ii", $textId, $userId);
			$stmt->execute();
			$affectedRows = $stmt->affected_rows;
			$stmt->close();
			return $affectedRows > 0;
		}
	}
