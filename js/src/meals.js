// Create global js objects to store ingredient / quantity as key/value respectively. Data is formatted in sendData().
var ingredientObj = {};
var data = {};

const url = "<APIGateway URL>"

function getMeals() {
    // // Send GET request to /meals API to retrieve all meals
    fetch(url).then(function (response) {
        return response.json();
    })
    .then(function (data) {
        appendData(data);
    })
    .catch(function (err) {
        console.log("error: " + err);
    }); 
}

function appendData(data) {
    // Appends GET response data to page.
    var main_container = document.getElementById("meals")
    var test = document.getElementById("meals")
    while (main_container.hasChildNodes()) {
        main_container.removeChild(main_container.lastChild);
    }  

    for (var i = 0; i < data.length; i++) {
        var div = document.createElement("div");
        div.innerHTML = "<pre>" + "Meal: " + data[i].meal  + "<br />" + " Ingredients: " + Object.keys(data[i].ingredients) +  ": " + Object.values(data[i].ingredients) + "</pre>";                
        main_container.appendChild(div);
    }
}  

function addInput() {
    // Creates text inputs based on number of ingredients entered by user.
    const maxIngredients = 16;
    var getMealName = document.getElementById("mealName").value;
    data.meal = getMealName
    console.log(data)
    
    // Dynamically adds text inputs depending on how many ingredients there are
    var getNumber = document.getElementById("ingredients").value;
    if (getNumber < maxIngredients) {
        var number = getNumber;
    } else {
        alert('Too many ingredients');
    }
    var container = document.getElementById("container")
    while (container.hasChildNodes()) {
        container.removeChild(container.lastChild);
    }
    // Loop through number of ingredients and add a text input for each ingredient
    for (i=0; i < number; i++) {
        container.appendChild(document.createTextNode("Ingredient " + (i+1) + ": "));
        var ingredientInput = document.createElement("input");
        ingredientInput.id = 'ingredient' + (i);
        var quantityInput = document.createElement("input");
        quantityInput.id = 'quantity' + (i);
        ingredientInput.type = "text"
        quantityInput.type = "text"
        container.appendChild(ingredientInput);
        container.appendChild(document.createTextNode("  Quantity: "));
        container.appendChild(quantityInput);
        container.appendChild(document.createElement("br"));
    }
}

function sendData() {
    // Retrieves meal name, ingredient and quantity data, and formats it into a payload for Lambda function.
    var ingredientNumber = document.getElementById("ingredients").value;

    for (i=0; i < ingredientNumber; i++) {
        // Get each input value and add them to object
        var ingredient = document.getElementById('ingredient' + i).value;
        var quantity = document.getElementById('quantity' + i).value;
        ingredientObj[ingredient] = quantity;
    }

    data.ingredients = ingredientObj;
    console.log(JSON.stringify(data))

    /// Post data to APIGW
    fetch(url, {
        method: "post",
        body: JSON.stringify(data)
    });
}