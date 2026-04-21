# Fuel Consumption App

### App Details
A fuel consumption monitoring app that calculates the fuel consumption by taking the car data and calculates the efficiency and consumption by using its gps location when driven.

### Vehicle Data Model

The vehicle data model contains the following
Vehicle make/model + year
Vehicle Fuel Type
Vehicle fuel tank maximum volume
Vehicle fuel tank current volume
fuel added to tank

## App Features

#
1. User Inputs vehicle details
Option 1 Search vehicle name then lookup using NHTSA vPIC API
then show dropdown of matching vehicle model then user will select one
option and store that specific vehicle data in the app

Option 2 Advanced input
For those who modded their Vehicles

2. User Input for current volume of fuel

3. User Input for fuel added after refueling and Price paid during said refueling

4. Fuel consumption calculation using the vehicle data as for movement utilize gps movement

5. Calculate fuel used as well as its equivalent cost and money saved.

# API Data

## Vehicle Data
for the ones that used the search function the following should be taken

vehicle manufacturer
vehicle model
Engine Type
Fuel Type
General Milage

Note the vehicle data can be manually entered if the user chooses advanced

## Fuel API
using DOE / RDAC Philippine Datasets // App focuses in the PH for now

it will retrieve
station ID
fuel type and price per liter
effective date
last updated time stamp and confidence

## Calculations
Fuel Used/Cost

Fuel Consumed Today

Fuel Consumed This Month

Money Spent

Money Saved