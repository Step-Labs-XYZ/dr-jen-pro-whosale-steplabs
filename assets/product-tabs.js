function showTab(indexToShow){
    
    document.querySelectorAll(`.tab_title`).forEach((title) => {
        title.classList.remove(`active`);
    })

    document.querySelectorAll(`.product-tabs-content`).forEach((title) => {
        title.classList.remove(`active`);
    })

    document.querySelectorAll(`.tab_title`)[indexToShow].classList.add(`active`);
    document.querySelectorAll(`.product-tabs-content`)[indexToShow].classList.add(`active`);

    
}