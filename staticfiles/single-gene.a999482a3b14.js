document.getElementById('gene-search-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent form submission

    // Get the gene ID from the input field
    const geneId = document.getElementById('gene-id').value;

    // Make an AJAX request to the Django view
    fetch(`http://127.0.0.1:8000/sGene?gene_id=${geneId}`)
        .then(response => response.json())
        .then(data => {
            // Update the architecture-diagram div with the results
            const architectureDiagram = document.getElementById('architecture-diagram');
            architectureDiagram.innerHTML = `
                <h2><span class="info-icon">🧬</span> ${geneId}</h2>
                <div class="diagram-content">
                    <div class="diagram-row">
                        <div class="diagram-box">
                            <h3>PFAM TABLE</h3>
                            <table class="results-table">
                                <thead>
                                    <tr>
                                        <th>Gene</th>
                                        <th>mRNA</th>
                                        <th>Pfam Accession</th>
                                        <th>Pfam Name</th>
                                        <th>Pfam Type</th>
                                        <th>E-value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.pfam.map(pfam => `
                                        <tr>
                                            <td>${pfam.Gene}</td>
                                            <td>${pfam.mRNA}</td>
                                            <td>${pfam.Pfma_acc}</td>
                                            <td>${pfam.Pfma_name}</td>
                                            <td>${pfam.Pfma_type}</td>
                                            <td>${pfam.evalue}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="arrow">↓</div>
                    <div class="diagram-row">
                        <div class="diagram-box">
                            <h3>GO TABLE</h3>
                            <table class="results-table">
                                <thead>
                                    <tr>
                                        <th>Gene</th>
                                        <th>mRNA</th>
                                        <th>GO Accession</th>
                                        <th>GO Name</th>
                                        <th>GO Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.gotable.map(go => `
                                        <tr>
                                            <td>${go.Gene}</td>
                                            <td>${go.mRNA}</td>
                                            <td>${go.GO_acc}</td>
                                            <td>${go.GO_name}</td>
                                            <td>${go.GO_type}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="arrow">↓</div>
                    <div class="diagram-row">
                        <div class="diagram-box">
                            <h3>EXPRESSION BOXPLOT TEST</h3>
                            <canvas id="myBoxplot"></canvas>
                        </div>
                    </div>
                </div>
            `;

            // Render the boxplot (you can use a charting library like Chart.js or Plotly)
            //renderBoxplot(data.boxplot);
            // createBoxPlot(data.boxplot)
            console.log(data.boxplot)
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
});

function createBoxPlot(dataObj) {
    const ctx = document.getElementById('myBoxplot').getContext('2d');
    
    const labels = Object.keys(dataObj);
    const dataset = labels.map(label => {
        const values = dataObj[label].sort((a, b) => a - b);
        return {
            min: Math.min(...values),
            q1: values[Math.floor(values.length * 0.25)],
            median: values[Math.floor(values.length * 0.5)],
            q3: values[Math.floor(values.length * 0.75)],
            max: Math.max(...values)
        };
    });
    
    const data = {
        labels: labels,
        datasets: [{
            label: 'Expression Levels',
            data: dataset,
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
            borderColor: 'rgba(0, 123, 255, 1)',
            borderWidth: 1
        }]
    };
    
    new Chart(ctx, {
        type: 'boxplot',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Expression Boxplot Visualization' }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Sample Groups' }
                },
                y: {
                    title: { display: true, text: 'Expression Levels' },
                    beginAtZero: true
                }
            }
        }
    });
}