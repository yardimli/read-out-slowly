<?php

	namespace App\Helpers;

	use mysqli;
	use mysqli_sql_exception;

	class Database
	{
		private static ?mysqli $mysqli = null;

		public static function getConnection(): ?mysqli
		{
			if (self::$mysqli === null) {
				$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
				$port = $_ENV['DB_PORT'] ?? '3306';
				$db = $_ENV['DB_DATABASE'] ?? 'read_out_slowly';
				$user = $_ENV['DB_USERNAME'] ?? 'root';
				$pass = $_ENV['DB_PASSWORD'] ?? '';

				// This will make mysqli throw exceptions on errors, which we can catch.
				mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

				try {
					self::$mysqli = new mysqli($host, $user, $pass, $db, (int)$port);
					self::$mysqli->set_charset('utf8mb4');
				} catch (mysqli_sql_exception $e) {
					error_log("Database Connection Error: " . $e->getMessage());
					// In a production environment, you might want a more user-friendly error page.
					die("Could not connect to the database. Please check the server configuration.");
				}
			}
			return self::$mysqli;
		}
	}
