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
        objName = String(object["name"])
        if (objName.includes("valve")  || objName.includes("temperature") ) {
            continue
        }
        dates.push(objName.slice(2, objName.length - 4));
    }
    return dates;
}

function dateToFileName(date){
    return "D_" + date + ".csv";
}

async function main(){
    const fileLinkURL = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLginCC_L3RWQw_dJ7PpwdNn1qLGUxB7nzsYuwTnoRW_zgV8m3IWNhC1gbuLL9N8Y4-KQaU-L3Zx2j-Mj2IZwrA5jHOFirfdkUlIDT1YQhFalonrU4JhAgja4_zMlJ3jD1JU42R-EEQTbEM6s5WKcgWvRCC46YabyJeXZvmA2jSeAVy9vOjo1do3CeO-3jbtNZiGb9U_UVpwV6nqzw_gUyjfVNHrhKUWmNMyhpG3MZrQu9D0gc1l3UtD-6lqGnc-Di0qSZuleGrIZppt18MIBJMgGAExAKsgZ_xbCmP5&lib=M-HyjyiesbmHJty7n_JcDF39H8mT1TTc1";

    const fileLinkJSON = await getFileLinks(fileLinkURL);
    console.log(constructDateArray(fileLinkJSON));
    const datesElement = document.getElementById("dates");
    if (datesElement) {
    datesElement.innerHTML = constructDateArray(fileLinkJSON).join(", ");
    } else {
    console.warn("No element with id 'dates' found!");
    }
}
main();
