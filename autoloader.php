<?php
/**
 * PSR-4 Autoloader for Mail App
 */

spl_autoload_register(function ($class) {
    // Namespace prefix
    $prefix = 'App\\';
    
    // Base directory for the namespace prefix
    $baseDir = __DIR__ . '/src/';
    
    // Check if the requested class uses our namespace
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    
    // Get the relative class name
    $relativeClass = substr($class, $len);
    
    // Replace namespace separators with directory separators
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
    
    // If the file exists, require it
    if (file_exists($file)) {
        require $file;
    }
});
?>