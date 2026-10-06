document.addEventListener("DOMContentLoaded", function () {

    document.getElementById("phone").addEventListener("input", function () {

        let phone = this.value.replace(/\D/g, "");

        if (phone.length > 10) {

            phone = phone.substring(0, 10);
        }

        if (phone.length >= 7) {

            this.value = "(" + phone.substring(0, 3) + ") "

                + phone.substring(3, 6) + "-"

                + phone.substring(6);

        } else if (phone.length >= 4) {

            this.value = "(" + phone.substring(0, 3) + ") "

                + phone.substring(3);

        } else if (phone.length > 0) {

            this.value = "(" + phone;

        } else {

            this.value = "";
        }
    });

      const savedData = sessionStorage.getItem("formData");

        if (savedData) {
            const formData = JSON.parse(savedData);

            document.getElementById("firstName").value = formData.firstName;
            document.getElementById("lastName").value = formData.lastName;
            document.getElementById("address").value = formData.address;
            document.getElementById("city").value = formData.city;
            document.getElementById("state").value = formData.state;
            document.getElementById("zip").value = formData.zip;
            document.getElementById("phone").value = formData.phone;
            document.getElementById("email").value = formData.email;
            document.getElementById("birthdate").value = formData.birthdate;
            document.getElementById("message").value = formData.message;
        }

   document.getElementById("contactForm").addEventListener("submit", function (event) {

        event.preventDefault();

        const phone = document.getElementById("phone").value;
        const phoneDigits = phone.replace(/\D/g, "");

        if (phoneDigits.length !== 10) {
            alert("Please enter a complete 10-digit phone number.");
            return;
        }

        const email = document.getElementById("email").value;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            alert("Please enter a valid email address.");
            return;
        }

        const birthdate = document.getElementById("birthdate").value;
        const birthdateObject = new Date(birthdate);
        const today = new Date();

        if (!birthdate || birthdateObject > today) {
            alert("Please enter a valid birth date that is not in the future.");
            return;
        }

        const address = document.getElementById("address").value.trim();
        const city = document.getElementById("city").value.trim();
        const state = document.getElementById("state").value;
        const zip = document.getElementById("zip").value.trim();

        const zipPattern = /^\d{5}(-\d{4})?$/;

        if (address.length < 5) {
            alert("Please enter a valid street address.");
            return;
        }

        if (city.length < 2) {
            alert("Please enter a valid city.");
            return;
        }

        if (!state) {
            alert("Please select a state.");
            return;
        }

        if (!zipPattern.test(zip)) {
            alert("Please enter a valid ZIP code.");
            return;
        }

        const message = document.getElementById("message").value.trim();

        if (message.length < 1) {
            alert("Please enter a message.");
            return;
        }

        const securityAnswer = document.getElementById("securityQuestion").value.trim();

        if (securityAnswer !== "20") {
            alert("Please answer the confirmation question correctly.");
            return;
        }

        const formData = {
            firstName: document.getElementById("firstName").value.trim(),
            lastName: document.getElementById("lastName").value.trim(),
            address: address,
            city: city,
            state: state,
            zip: zip,
            phone: phone,
            email: email,
            birthdate: birthdate,
            message: message
        };

        sessionStorage.setItem("formData", JSON.stringify(formData));

        window.location.href = "confirmation.html";
    });


});