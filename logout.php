<?php
	session_start();
	require __DIR__ . '/vendor/autoload.php';

	use App\Helpers\AuthHelper;

	AuthHelper::logoutUser();
	header('Location: login.php');
	exit;
