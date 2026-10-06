function calculate() {
    const principal = Number(document.getElementById("principal").value);
    const rate = Number(document.getElementById("rate").value) / 100;
    const years = Number(document.getElementById("years").value);

    const amount = principal * Math.pow(1 + rate, years);

    document.getElementById("result").textContent =
    
        "Final Amount: $" + amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })

    const data = [];

    for (let year = 0; year <= years; year++) {
        const balance = principal * Math.pow(1 + rate, year);

        data.push([year, balance]);
    }

    Highcharts.chart("chart", {
        title: {
            text: "Compound Interest Growth"
        },

        xAxis: {
            title: {
                text: "Time (Years)"
            }
        },

        yAxis: {
            title: {
                text: "Account Value ($)"
            }
        },

        series: [{
            name: "Investment Value",
            data: data,
            tooltip: {
                pointFormat: "Investment Value: <b>${point.y:,.2f}</b>"
            }
        }]
    });
}