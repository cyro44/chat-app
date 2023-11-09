export { newToast };

const toastHolder = document.createElement("div");
toastHolder.classList.add("toast-holder");

function newToast(title, description, type = "none", timeout = 5000) {
    const toast = document.createElement("div");
    toast.classList.add("toast");
    toast.classList.add(type);

    const toastTitle = document.createElement("h1");
    toastTitle.innerText = title;

    const toastDescription = document.createElement("p");
    toastDescription.innerText = description;

    const toastTimeoutBarHolder = document.createElement("div");
    toastTimeoutBarHolder.classList.add("progress-outer");

    const toastTimeoutBar = document.createElement("div");
    toastTimeoutBar.classList.add("progress-inner");
    toastTimeoutBar.style.width = "100%";

    toast.appendChild(toastTitle);
    toast.appendChild(toastDescription);

    toastTimeoutBarHolder.appendChild(toastTimeoutBar);
    toast.appendChild(toastTimeoutBarHolder);

    toastHolder.appendChild(toast);

    var toastInterval = setInterval(() => {
        toastTimeoutBar.style.width =
            parseInt(toastTimeoutBar.style.width) - 1 + "%";
        if (parseInt(toastTimeoutBar.style.width) <= 0) {
            clearInterval(toastInterval);
            toast.classList.add("done");
            setTimeout(() => {
                toast.remove();
            }, 290);
        }
    }, timeout / 100);

    toast.addEventListener("click", () => {
        toast.remove();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(toastHolder);
});
