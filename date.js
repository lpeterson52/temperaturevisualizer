export function isDateBefore(date1, date2){
    return new Date(date1) <= new Date(date2);
}
export function isDateAfter(date1, date2){
    return new Date(date1) >= new Date(date2);
}

export function getStartDate(){
    return document.getElementById("start-date-input").value.toLowerCase();
}

export function getEndDate(){
    return document.getElementById("end-date-input").value.toLowerCase();
}