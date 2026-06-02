document.addEventListener('DOMContentLoaded', () => {
    let step = 1;
    let isMobile = window.innerWidth < 768 ? true : false;

    setTimeout(() => {
        let btnWrapper = document.querySelector(".new-register-section__container .wizard__footer");
        let pBtn = document.querySelector(".new-register-section__container .wizard__footer button.previous");
        let nBtn = document.querySelector(".new-register-section__container .wizard__footer button.next");
        let sNums = document.querySelectorAll(".new-register-section__step-number");
        let sNames = document.querySelectorAll(".new-register-section__step-name");

        nBtn.addEventListener('click', () => {
            step++;
            stepChange();
        })

        pBtn.addEventListener('click', () => {
            step--;
            stepChange();
        })

        function stepChange() {
            if (step === 1) {
                btnWrapper.style.display = "block";
                nBtn.innerHTML = "Next";
                pBtn.style.display = "none";
                sNums.forEach((num, index) => {
                    if (index === 0) {
                        num.innerHTML = index + 1;
                        num.style.background = "#E04880";
                        sNames[index].style.color = "#1D2433";
                        sNames[index].style.display = "block";
                    } else {
                        num.innerHTML = index + 1;
                        num.style.background = "#9898A6";
                        sNames[index].style.color = "#9898A6";
                        sNames[index].style.display = isMobile ? "none" : "block";
                    }

                })
            }

            if (step === 2) {
                btnWrapper.style.display = "flex";
                nBtn.innerHTML = "Last Step";
                pBtn.style.display = "block";
                sNums.forEach((num, index) => {
                    if (index === 0) {
                        num.innerHTML = "&#10004;";
                        num.style.background = "#8AE4E1";
                        sNames[index].style.color = "#1D2433";
                        sNames[index].style.display = isMobile ? "none" : "block";
                    } else if (index === 1) {
                        num.innerHTML = index + 1;
                        num.style.background = "#E04880";
                        sNames[index].style.color = "#1D2433";
                        sNames[index].style.display = "block";
                    } else {
                        num.innerHTML = index + 1;
                        num.style.background = "#9898A6";
                        sNames[index].style.color = "#9898A6";
                        sNames[index].style.display = isMobile ? "none" : "block";
                    }

                })
            }

            if (step === 3) {
                btnWrapper.style.display = "block";
                nBtn.innerHTML = "Submit";
                pBtn.style.display = "none";
                sNums.forEach((num, index) => {
                    if (index === 2) {
                        num.innerHTML = index + 1;
                        num.style.background = "#E04880";
                        sNames[index].style.color = "#1D2433";
                        sNames[index].style.display = "block";
                    } else {
                        num.innerHTML = "&#10004;";
                        num.style.background = "#8AE4E1";
                        sNames[index].style.color = "#1D2433";
                        sNames[index].style.display = isMobile ? "none" : "block";
                    }

                })
            }
        }

    }, 1000);
})