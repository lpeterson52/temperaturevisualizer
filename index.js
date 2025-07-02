import { getStartDate, getEndDate, isDateAfter, isDateBefore} from "./date.js";

let dates = [];
let currFile = "";

document.getElementById("search-input").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    if (dates.length != 0){
        const filtered = dates.filter(date => date.toLowerCase().includes(query));
        displayItems(filtered, "dates-container");
    }
});

document.getElementById("start-date-form").addEventListener("submit", (e) => {
    e.preventDefault();
});

document.getElementById("end-date-form").addEventListener("submit", (e) => {
    e.preventDefault();
});

document.getElementById("range-search-button").addEventListener("click", (e) => {
    let filteredItems;
    if (getStartDate() == "" && getEndDate() == "") {
        filteredItems = dates;
    } else if (getStartDate() == "") {
        filteredItems = dates.filter(item => isDateBefore(item, getEndDate()));
    } else if (getEndDate() == "") {
        filteredItems = dates.filter(item => isDateAfter(item, getStartDate()));
    } else {
        filteredItems = dates.filter(item => isDateAfter(item, getStartDate()) && isDateBefore(item, getEndDate()));
    }
    displayItems(filteredItems, "range-search-container");
});

async function getFileLinks(fileLinkURL){
    console.log("getting links");
    const response = await fetch(fileLinkURL);
    const fileLinkJSON = await response.json();
    console.log("got links");
    return fileLinkJSON;
}

function constructDateArray(fileLinkJSON){
    const dates = [];
    for (const object of fileLinkJSON) {
        const objName = String(object["name"]);
        if (objName.includes("valve") || objName.includes("temperature")) {
            continue;
        }
        dates.push(objName.slice(2, objName.length - 4));
    }
    return dates;
}

function dateToFileName(date){
    return "D_" + date + ".csv";
}

function displayItems(filteredItems, containerName) {
    const container = document.getElementById(containerName)
    container.innerHTML = "";
    filteredItems.forEach(item => {
        const dateButton = document.createElement("button");
        dateButton.className = "searchable";
        dateButton.textContent = item;
        dateButton.onclick = () => {
            currFile = dateToFileName(item);
            console.log(currFile);
            test = document.getElementById("test");
            test.innerHTML = "Current file: " + currFile;
        }
        container.appendChild(dateButton);
    });
}

function handleSearch(event){
    event.preventDefault();
    const query = document.getElementById("search-input").value.toLowerCase();
    const filtered = dates.filter(item => item.toLowerCase().includes(query));
    displayItems(filtered, "dates-container");
}

async function main(){
    const fileLinkURL = "https://script.google.com/macros/s/AKfycbzNeJvs8VXCqja9ia-DY3lORan0-z1L-H_LonUwDnZ6_wbNsU7mS779S1AvWYIPV8oH4g/exec";

    const fileLinkJSON = await getFileLinks(fileLinkURL);
    dates = constructDateArray(fileLinkJSON); // use global `dates`
    console.log(dates);
    displayItems(dates, "dates-container");
    displayItems(dates, "range-search-container");
}

main();
