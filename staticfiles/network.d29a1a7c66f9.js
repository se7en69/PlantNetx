document.getElementById('multi-gene-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const genes = document.getElementById('genes-input').value.split('\n').map(g => g.trim());
    //console.log(genes[0])
    // Show loading state
    document.getElementById('main-content').innerHTML = '<div class="loading">Loading results...</div>';
    //console.log(`http://127.0.0.1:8000/network?genes-out=${encodeURIComponent(genes.join(','))}`);

    fetch(`https://plantnetx.academic.kube.ohio.edu/network?genes-out=${encodeURIComponent(genes.join(','))}`)
        .then(response => response.json())
        .then(data => {
            renderResults(data);
            document.querySelector('.result-buttons').classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('main-content').innerHTML = '<div class="loading">Error loading results</div>';
        });
});

function renderResults(data) {
    console.log('Received data:', data);
    console.log('Gene notes data (gnote_co):', data.gnote_co);
    
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <section class="gene-set">
            <h1>
                <span class="info-icon">🧬</span>
                Gene set of ${new Set(data.genes.map(g => g.Gene)).size} genes
            </h1>

            <!-- Genes Table -->
            <table id="basic_info" class="gene-table">
                <thead>
                    <tr>
                        <th>Gene</th>
                        <th>mRNA</th>
                        <th>Pfam Accession</th>
                        <th>Pfam Name</th>
                        <th>Note</th>
                        <th>Pfam Type</th>
                        <th>E-value</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.genes.map(gene => `
                        <tr>
                            <td>${gene.Gene}</td>
                            <td>${gene.mRNA}</td>
                            <td>${gene.Pfma_acc.split('?')[0]}</td>
                            <td>${gene.Pfma_name}</td>
                            <td>${gene.Note}</td>
                            <td>${gene.Pfma_type}</td>
                            <td>${gene.evalue}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <button class="result-btn active" data-section="basic-info" onClick="downloadTableAsCSV('basic_info', 'Basic_info.csv')">Download</button>
            
            <!-- Network Visualization -->
            <h2 class="section-title">CO-EXPRESSION NETWORK</h2>
            <button class="download-btn" data-content-key="dataset1" data-filename="interactions1.sif">Download Dataset 1</button>
            <div id="cy"></div>

            <h2 class="section-title">CO-EXPRESSION NETWORK</h2>
            <div id="heatmap-container"></div>

            <div id="heatmap-container">
            </div>
            
            <div class="diagram-row">
                <div class="diagram-box" id="network" style="display: none;">
                    <h3>NETWORK</h3>
                    <button class="network-button" id="show-network">Show Co-expression Network</button>
                    <div class="filter-controls">
                        <button class="mutual-filter" data-rank="5">Mutual Rank ≤5</button>
                        <button class="mutual-filter" data-rank="10">Mutual Rank ≤10</button>
                        <button class="mutual-filter" data-rank="15">Mutual Rank ≤15</button>
                        <button class="mutual-filter" data-rank="20">Mutual Rank ≤20</button>
                        <button class="mutual-filter" data-rank="30">Mutual Rank ≤30</button>
                        <button class="mutual-filter" data-rank="100">Mutual Rank >30</button>
                        <button class="download-btn" id="download-filtered-network" data-filename="interactions2.sif">Download Network (.sif)</button>
                        <button class="download-btn" id="download-mr-values" data-filename="mr_values.tsv">Download MR Values (.tsv)</button>
                        <button class="download-btn" id="download-gene-notes" data-filename="gene_notes.tsv">Download Gene Notes (.tsv)</button>
                        <button class="download-btn" id="download-current-filtered-notes" data-filename="filtered_gene_notes.tsv">Download Filtered Gene Notes (.tsv)</button>
                    </div>
                    <div id="current-filter-info" style="margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">
                        Current Filter: Mutual Rank ≤ 100 (default)
                    </div>
                    <div id="network-container"></div>
                </div>
            </div>
            <div class="diagram-row">
                <div class="diagram-box" id="mrank" style="display: none;">
                    <h3>Mutual Rank</h3>
                    <div id="mrank-container" class="mrank-container">
                        <table id = "mrank" class="results-table">
                            <thead>
                                <tr>
                                    <th>Query</th>
                                    <th>Target</th>
                                    <th>M.Rank</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.mrank.map(rank => `
                                    <tr>
                                        <td>${rank.Gene1}</td>
                                        <td>${rank.Gene2}</td>
                                        <td>${rank.MRank}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <button class="result-btn active" data-section="basic-info" onClick="downloadTableAsCSV('mrank', 'Mutual_rank.csv')">Download</button>
                    </div>
                </div>
            </div>
            <!-- Buttons -->
            <button class="download-button" onclick="downloadData()">
                ⬇️ Download table
            </button>

            <button class="network-button" onclick="plotNetwork()">
                🔗 Plot the network of these genes
            </button>
        </section>
    `;
    
    // Download Network
    const contentMap = {
        "dataset1": data.q_cyt,
    };
    bindDownloadToButtons(".download-btn", contentMap);
    
    // Render the network using Cytoscape.js
    renderNetwork(data.network_co, data.nodes_co);
    renderPlotlyHeatmap(data.fexpression, data.series_names, data.row_sample);
    
    // Add network button functionality
    let currentCy = null;
    let originalNetworkData = null;
    let originalNodesData = null;
    let currentFilteredNetworkData = null;
    let currentFilteredNodesData = null;
    let currentFilterRank = 100; // Default filter

    // Initialize network data
    originalNetworkData = data.fnetwork;
    originalNodesData = data.fnodes;
    currentFilteredNetworkData = data.fnetwork;
    currentFilteredNodesData = data.fnodes;

    // Update filter info display
    function updateFilterInfo(rank) {
        const filterInfo = document.getElementById('current-filter-info');
        filterInfo.textContent = `Current Filter: Mutual Rank ≤ ${rank}`;
        currentFilterRank = rank;
    }

    // Modified event listener with filtering
    document.getElementById('show-network').addEventListener('click', () => {
        const container = document.getElementById('network-container');
        container.style.display = 'block';
        renderNetwork_co(originalNetworkData, originalNodesData);
        updateFilterInfo(100); // Reset to default
    });

    // Add filter button handlers
    document.querySelectorAll('.mutual-filter').forEach(button => {
        button.addEventListener('click', () => {
            const maxRank = parseInt(button.dataset.rank);
            const filtered = filterByMutualRank(originalNetworkData, originalNodesData, maxRank);
            
            // Store the filtered data for download
            currentFilteredNetworkData = filtered.edges;
            currentFilteredNodesData = filtered.nodes;
            
            renderNetwork_co(filtered.edges, filtered.nodes);
            updateFilterInfo(maxRank);
        });
    });

    // Add download button handler for filtered network
    document.getElementById('download-filtered-network').addEventListener('click', function(e) {
        e.preventDefault();
        
        if (currentFilteredNetworkData) {
            const sifContent = generateSIFContent(currentFilteredNetworkData);
            const filename = this.getAttribute('data-filename') || 'interactions2.sif';
            downloadSIF(sifContent, filename);
        } else {
            alert('Please apply a filter first or load the network data.');
        }
    });

    // Add download button handler for MR values
    document.getElementById('download-mr-values').addEventListener('click', function(e) {
        e.preventDefault();
        
        if (currentFilteredNetworkData) {
            const mrContent = generateMRContent(currentFilteredNetworkData);
            const filename = this.getAttribute('data-filename') || 'mr_values.tsv';
            downloadTSV(mrContent, filename);
        } else {
            alert('Please apply a filter first or load the network data.');
        }
    });

    // Add download button handler for all gene notes (unfiltered)
    document.getElementById('download-gene-notes').addEventListener('click', function(e) {
        e.preventDefault();
        const filename = this.getAttribute('data-filename') || 'gene_notes.tsv';
        
        console.log('Available gene notes data:', {
            gnote_co: data.gnote_co,
            gnote: data.gnote,
            fgnote: data.fgnote
        });
        
        // Try to get gene notes from various sources
        let geneNotesData = null;
        
        if (data.gnote_co && Array.isArray(data.gnote_co)) {
            geneNotesData = data.gnote_co;
            console.log('Using gnote_co data, count:', geneNotesData.length);
        } else if (data.gnote && Array.isArray(data.gnote)) {
            geneNotesData = data.gnote;
            console.log('Using gnote data, count:', geneNotesData.length);
        } else if (data.fgnote && Array.isArray(data.fgnote)) {
            geneNotesData = data.fgnote;
            console.log('Using fgnote data, count:', geneNotesData.length);
        } else if (data.nodes_co && Array.isArray(data.nodes_co)) {
            // Extract from nodes as fallback
            geneNotesData = extractGeneNotesFromNodes(data.nodes_co);
            console.log('Extracted from nodes_co, count:', geneNotesData.length);
        }
        
        if (geneNotesData && geneNotesData.length > 0) {
            console.log('First few gene notes:', geneNotesData.slice(0, 5));
            downloadGeneNotes(geneNotesData, filename);
        } else {
            alert('No gene notes data available. Please check the data source.');
        }
    });

    // Add download button handler for CURRENT FILTERED gene notes
    document.getElementById('download-current-filtered-notes').addEventListener('click', function(e) {
        e.preventDefault();
        const filename = `mutual_rank_${currentFilterRank}_gene_notes.tsv`;
        
        console.log('Downloading filtered gene notes for MR ≤', currentFilterRank);
        
        // Get gene notes for currently filtered network
        let geneNotesData = null;
        
        if (currentFilteredNodesData && Array.isArray(currentFilteredNodesData)) {
            // Extract gene notes from the currently filtered nodes
            geneNotesData = extractGeneNotesFromNodes(currentFilteredNodesData);
            console.log('Filtered gene notes count:', geneNotesData.length);
            
            if (geneNotesData.length > 0) {
                downloadGeneNotes(geneNotesData, filename);
            } else {
                alert('No genes in the current filtered network. Please adjust your filter.');
            }
        } else {
            alert('No network data available. Please load the network first.');
        }
    });

    const genes = document.getElementById('genes-input').value.split('\n').map(g => g.trim());
    renderHeatmap(data.rank, genes);
    
    // Add tab functionality for rankings
    document.querySelectorAll('#rank-tabs .tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#rank-tabs .tab-button').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            document.getElementById('rank-tables').innerHTML = renderRankTable(data.rank);
        });
    });
}

// Enhanced filter function that returns both edges and nodes
function filterByMutualRank(edges, nodes, maxRank) {
    // Filter edges by mutual rank
    const filteredEdges = edges.filter(edge => edge.data.mutualRank <= maxRank);
    
    // Get unique gene IDs from filtered edges
    const geneIds = new Set();
    filteredEdges.forEach(edge => {
        geneIds.add(edge.data.source);
        geneIds.add(edge.data.target);
    });
    
    // Filter nodes to only include those present in filtered edges
    const filteredNodes = nodes.filter(node => geneIds.has(node.data.id));
    
    return {
        edges: filteredEdges,
        nodes: filteredNodes
    };
}

// SIF generation function
function generateSIFContent(networkData) {
    // Group targets by source
    const sourceMap = {};
    
    networkData.forEach(edge => {
        const source = edge.data.source;
        const target = edge.data.target;
        
        if (!sourceMap[source]) {
            sourceMap[source] = [];
        }
        
        sourceMap[source].push(target);
    });
    
    // Generate SIF content
    let sifContent = '';
    
    for (const source in sourceMap) {
        if (sourceMap.hasOwnProperty(source)) {
            const targets = sourceMap[source].join(' ');
            sifContent += `${source} coexpressed ${targets}\n`;
        }
    }
    
    return sifContent;
}

// MR values generation function (tab-delimited)
function generateMRContent(networkData) {
    // Create header
    let mrContent = 'Source\tTarget\tMutualRank\n';
    
    // Add each edge with MR value
    networkData.forEach(edge => {
        const source = edge.data.source;
        const target = edge.data.target;
        const mutualRank = edge.data.mutualRank;
        
        mrContent += `${source}\t${target}\t${mutualRank}\n`;
    });
    
    return mrContent;
}

// Gene notes generation function (tab-delimited) with error handling
function generateGeneNotesContent(geneNotes) {
    // Check if geneNotes is an array
    if (!Array.isArray(geneNotes)) {
        console.error('geneNotes is not an array:', geneNotes);
        return 'Gene\tNote\n';
    }
    
    // Create header
    let notesContent = 'Gene\tNote\n';
    
    // Add each gene with its note
    geneNotes.forEach(gene => {
        // Check if gene is an object with Gene and Note properties
        if (gene && typeof gene === 'object' && 'Gene' in gene) {
            notesContent += `${gene.Gene}\t${gene.Note || ''}\n`;
        } else {
            console.warn('Invalid gene object:', gene);
        }
    });
    
    return notesContent;
}

// Extract gene notes from nodes data
function extractGeneNotesFromNodes(nodes) {
    if (!Array.isArray(nodes)) return [];
    
    const geneNotes = [];
    nodes.forEach(node => {
        if (node.data && node.data.id) {
            geneNotes.push({
                Gene: node.data.id,
                Note: node.data.note || ''
            });
        }
    });
    return geneNotes;
}

// Download function for SIF
function downloadSIF(content, filename = 'network.sif') {
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Download function for TSV
function downloadTSV(content, filename = 'data.tsv') {
    const blob = new Blob([content], { type: 'text/tab-separated-values' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Download function for gene notes with robust error handling
function downloadGeneNotes(geneNotes, filename = 'gene_notes.tsv') {
    try {
        // Ensure geneNotes is an array
        if (!Array.isArray(geneNotes)) {
            if (geneNotes && typeof geneNotes === 'object') {
                // Convert object to array if needed
                geneNotes = Object.keys(geneNotes).map(key => ({
                    Gene: key,
                    Note: geneNotes[key]
                }));
            } else {
                throw new Error('Gene notes data is not in a valid format');
            }
        }
        
        const content = generateGeneNotesContent(geneNotes);
        downloadTSV(content, filename);
    } catch (error) {
        console.error('Error downloading gene notes:', error);
        alert('Error generating gene notes file: ' + error.message);
    }
}
// Download Cytoscape
function bindDownloadToButtons(buttonClass, contentMap) {
    const buttons = document.querySelectorAll(buttonClass);
    buttons.forEach(button => {
        button.addEventListener('click', function () {
            const key = this.getAttribute('data-content-key');
            const content = contentMap[key];
            const filename = this.getAttribute('data-filename') || 'download.txt';

            if (!content) {
                console.warn(`No content found for key: ${key}`);
                return;
            }

            const blob = new Blob([content], { type: 'text/tab-separated-values' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });
}
// Download Table data 
function downloadTableAsCSV(tableId, filename) {
    let table = document.getElementById(tableId);
    let rows = table.querySelectorAll("tr");
    let csvContent = "";

    rows.forEach(row => {
        let cols = row.querySelectorAll("th, td");
        let rowData = [];
        cols.forEach(col => rowData.push(`"${col.innerText}"`));
        csvContent += rowData.join(",") + "\n";
    });

    let blob = new Blob([csvContent], { type: "text/csv" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function renderHeatmap(rankData, genes) {
    // Extract original gene names
    const geneNames = genes;

    // Prepare heatmap data
    let heatmapData = [];
    rankData.forEach((row, i) => {
        row.forEach((value, j) => {
            heatmapData.push({
                x: geneNames[j], // Use original gene name for X-axis
                y: geneNames[i], // Use original gene name for Y-axis
                heat: value
            });
        });
    });

    // Create and configure heatmap
    anychart.onDocumentReady(function () {
        let chart = anychart.heatMap(heatmapData);
        
        // Customize color scale (red to blue)
        chart.colorScale().colors([
            { color: '#ff0000', offset: 0 }, // Red for lower ranks
            {color: '#ffff00', offset: 0.5},
            { color: '#0000ff', offset: 1 }  // Blue for higher ranks
        ]);
        
        // Add labels
        chart.labels().enabled(true).format('{%heat}');
        
        // Configure axes
        chart.xAxis().staggerMode(true);
        chart.yAxis().staggerMode(true);
        
        // Set container and draw
        chart.container('heatmap-container');
        chart.title('Mutual Rank Heatmap');
        chart.draw();
    });
}
// render heatmap using plotly js
function renderPlotlyHeatmap(rankData, xLabels, yLabels, containerId = 'heatmap-container') {
    // Parse data if strings (Django to JS)
    if (typeof rankData === 'string') rankData = JSON.parse(rankData);
    if (typeof xLabels === 'string') xLabels = JSON.parse(xLabels);
    if (typeof yLabels === 'string') yLabels = JSON.parse(yLabels);

    // Create the heatmap trace
    const trace = {
        z: rankData,
        x: xLabels,
        y: yLabels,
        type: 'heatmap',
        colorscale: [
            [0, '#e6f7ff'],  // Light blue (min)
            [1, '#006699']   // Dark blue (max)
        ],
        hoverongaps: false,
        showscale: true,  // Show color legend
        colorbar: {
            title: 'Expression',
            titleside: 'right'
        }
    };

    // Layout configuration
    const layout = {
        title: 'Gene Expression Heatmap',
        xaxis: {
            tickangle: -90,  // Rotate x-axis labels 90°
            tickfont: {
                size: 8  // Smaller font size
            },
            automargin: true  // Prevents label cutoff
        },
        yaxis: {
            automargin: true
        },
        margin: {
            l: 150,  // Left margin (for y-axis labels)
            r: 50,   // Right margin
            b: 150,  // Bottom margin (for rotated x-axis labels)
            t: 50    // Top margin
        }
    };

    // Config (disable cell values)
    const config = {
        displayModeBar: true,  // Show the toolbar
        staticPlot: false      // Keep interactivity
    };

    // Render the plot
    Plotly.newPlot(
        document.getElementById(containerId),
        [trace],
        layout,
        config
    );
}
// render Network
function renderNetwork(networkData, nodesData) {
    const cy = cytoscape({
        container: document.getElementById('cy'),
        elements: {
            nodes: nodesData,
            edges: networkData
        },
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(id)',
                    'background-color': '#4a4a4a',
                    'color': '#000000',
                    'text-valign': 'top',
                    'text-halign': 'center',
                    'text-margin-y': -5,
                    'width': function (edge) {
                        const mutualRank = edge.data('mutualRank');
                        // Example: Scale mutualRank to a range of 1 to 10
                        return Math.round(1, Math.min(5, mutualRank))+50;
                        console.log(Math.round(1, Math.min(5, mutualRank / 5)+50))
                    },
                    'height': 50,
                    'border-width': 2,
                    'border-color': '#FFFFFF',
                    'font-size': 12,
                    'font-weight': 'bold'
                }
            },
            {
                selector: 'edge',
                style: {
                    'line-color': '#9E9E9E',
                    'curve-style': 'bezier',
                    'target-arrow-color': '#9E9E9E',
                    'arrow-scale': 1.5,
                    'line-style': 'solid',
                    // Map mutualRank to line-width
                    'width': function (edge) {
                        const mutualRank = edge.data('mutualRank')+5;
                        // Example: Scale mutualRank to a range of 1 to 10
                        return mutualRank;
                        console.log(Math.round(1, Math.min(5, mutualRank / 5)+50))
                    },
                    'line-opacity': 0.8,
                    'shadow-blur': 5,
                    'shadow-color': '#333',
                    'shadow-offset-x': 1,
                    'shadow-offset-y': 1
                }
            }
        ],
        layout: {
            name: 'cose',
            animate: true,
            fit: true,
            padding: 30,
            nodeRepulsion: 4500,
            idealEdgeLength: 100,
            gravity: 0.25
        }
    });

    // Add hover effects for nodes and edges (optional)
    cy.on('mouseover', 'edge', function (event) {
        const edge = event.target;
        const mutualRank = edge.data('mutualRank');

        edge.style({
            'label': `MR: ${mutualRank}`,
            'font-size': '10px',
            'text-rotation': 'autorotate',
            'color': '#000',
            'text-background-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-padding': 2,
            'text-border-opacity': 1,
            'text-border-color': '#dcb24b',
            'text-border-width': 0.5
        });
    });


    cy.on('mouseout', 'edge', function (event) {
        const edge = event.target;

        edge.style({
            'label': '',
            'line-color': '#dcb24b',
            'target-arrow-color': '#dcb24b',
            'width': edge.data('mutualRank') + 5,
            'transition-property': 'line-color, width, label',
            'transition-duration': '0.3s'
        });
    });

    // Fit the graph to the container after rendering
    cy.fit();
}
// Co-expressed Network

function renderNetwork_co(networkData, nodesData) {
    const cy = cytoscape({
        container: document.getElementById('network-container'),
        elements: {
            nodes: nodesData,
            edges: networkData
        },
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(id)',
                    'background-color': '#4a4a4a', // Default node color
                    'color': '#000000',
                    'text-valign': 'top',
                    'text-halign': 'center',
                    'text-margin-y': -5,
                    'width': function (edge) {
                        const mutualRank = edge.data('mutualRank');
                        return Math.round(1, Math.min(5, mutualRank))+50;
                    },
                    'height': 50,
                    'border-width': 2,
                    'border-color': '#FFFFFF',
                    'font-size': 12,
                    'font-weight': 'bold'
                }
            },
            {
                selector: 'node[isQuery = "true"]', // Assuming your query node has isQuery=true in its data
                style: {
                    'background-color': '#FF5722', // Orange color for query node
                    'border-color': '#FFEB3B', // Yellow border for query node
                    'border-width': 3,
                    'width': 60, // Slightly larger
                    'height': 60
                }
            },
            {
                selector: 'edge',
                style: {
                    'line-color': '#dcb24b',
                    'curve-style': 'bezier',
                    'target-arrow-color': '#9E9E9E',
                    'arrow-scale': 1.5,
                    'line-style': 'solid',
                    'width': function (edge) {
                        const mutualRank = edge.data('mutualRank')+5;
                        return mutualRank;
                    },
                    'line-opacity': 0.8,
                    'shadow-blur': 5,
                    'shadow-color': '#333',
                    'shadow-offset-x': 1,
                    'shadow-offset-y': 1
                }
            },
            {
                selector: 'edge[source = "query"]', // If edges from query node are marked
                style: {
                    'line-color': '#FF5722',
                    'target-arrow-color': '#FF5722'
                }
            }
        ],
        layout: {
            name: 'cose',
            animate: true,
            fit: true,
            padding: 30,
            nodeRepulsion: 4500,
            idealEdgeLength: 100,
            gravity: 0.25
        }
    });

    // Add hover effects for nodes and edges (optional)
    cy.on('mouseover', 'edge', function (event) {
        const edge = event.target;
        const mutualRank = edge.data('mutualRank');

        edge.style({
            'label': `MR: ${mutualRank}`,
            'font-size': '10px',
            'text-rotation': 'autorotate',
            'color': '#000',
            'text-background-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-padding': 2,
            'text-border-opacity': 1,
            'text-border-color': '#dcb24b',
            'text-border-width': 0.5
        });
    });


    cy.on('mouseout', 'edge', function (event) {
        const edge = event.target;

        edge.style({
            'label': '',
            'line-color': '#dcb24b',
            'target-arrow-color': '#dcb24b',
            'width': edge.data('mutualRank') + 5,
            'transition-property': 'line-color, width, label',
            'transition-duration': '0.3s'
        });
    });

    // Fit the graph to the container after rendering
    cy.fit();
}
// filter rank data
// Filter function (modified from previous)

// Hiden divs
function toggleDiv(id) {
    const element = document.getElementById(id);
    if (element.style.display === 'none' || element.style.display === '') {
        element.style.display = 'block';
    } else {
        element.style.display = 'none';
    }
}

// Example button handlers
function downloadData() {
    // Implement download functionality
}

function plotNetwork() {
    // Implement network plotting
}

// Example data loader
document.getElementById('example-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('genes-input').value = [
        'LOC_Os01g01660',
        'LOC_Os01g01670',
        'LOC_Os01g01680'
    ].join('\n');
});