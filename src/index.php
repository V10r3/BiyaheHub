<?php
// index.php

// App details (can be fetched from a database or API in a real-world scenario)
$appDetails = [
    "overview" => "A route map that displays traffic. The app has three dashboards: one for PUV/PUJ, one for Private Drivers, and one for commuters.",
    "features" => [
        "PUV/PUJ Driver Dashboard" => [
            "A map showing traffic details for fixed routes.",
            "Optional: Integration with RF card payment to track passengers based on seat availability."
        ],
        "Private Driver Dashboard" => [
            "Interactive map to plot destinations with options to type, pick manually, or use GPS.",
            "Traffic notifications with alternate route suggestions."
        ],
        "Commuter Dashboard" => [
            "Interactive map to plot destinations with traffic details.",
            "Clock to set arrival time.",
            "Shows jeeps, buses, taxis, and trains (if applicable).",
            "Jeepney selection based on designation (e.g., 01K Urgello to Parkmall).",
            "Bus tracking with pickup/drop-off stops.",
            "Shows occupied/unoccupied seats for integrated buses/PUVs.",
            "Taxi tracking with pickup/unload areas.",
            "Best route suggestions with minimal rides and fare.",
            "Traffic notifications with alternate route suggestions."
        ]
    ]
];
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>App Homepage</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
        }
        header {
            background: #0078D7;
            color: #fff;
            padding: 10px 20px;
            text-align: center;
        }
        nav {
            background: #333;
            color: #fff;
            padding: 10px;
            text-align: center;
        }
        nav a {
            color: #fff;
            margin: 0 10px;
            text-decoration: none;
        }
        section {
            padding: 20px;
        }
        h1, h2, h3 {
            color: #0078D7;
        }
        ul {
            list-style: disc;
            margin-left: 20px;
        }
    </style>
</head>
<body>
    <header>
        <h1>Welcome to the Traffic Route App</h1>
    </header>
    <nav>
        <a href="#overview">Overview</a>
        <a href="#features">Features</a>
    </nav>
    <section id="overview">
        <h2>App Overview</h2>
        <p><?php echo $appDetails['overview']; ?></p>
    </section>
    <section id="features">
        <h2>App Features</h2>
        <?php foreach ($appDetails['features'] as $dashboard => $features): ?>
            <h3><?php echo $dashboard; ?></h3>
            <ul>
                <?php foreach ($features as $feature): ?>
                    <li><?php echo $feature; ?></li>
                <?php endforeach; ?>
            </ul>
        <?php endforeach; ?>
    </section>
</body>


</html>