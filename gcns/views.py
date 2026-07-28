from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
import numpy as np
import pandas as pd
import networkx as nx
from math import sqrt
from .models import GeneData
from .models import GeneNote
from .models import MetaData
from .models import Pfam
from .models import Gontology
from .models import MutualRank
import json
# Create your views here.

def home(request):
    return render(request, "home.html")
def contact(request):
    return render(request, "contact.html")
def guide(request):
    return render(request, "guide.html")

def sgsearch(request):
    return render(request, "single-gene.html")
def mgsearch(request):
    return render(request, "network.html")
def coexpressed(request):
    return render(request, "co-expressed.html")

############################################## Network Construction #########################################
########################### PCC algorithm ########################
def pcc(gene_expression, thresh, query):
    # Calculate Pearson correlation matrix
    correlation_matrix = np.corrcoef(gene_expression, rowvar=True)

    # Rank the correlations for each gene
    rank_matrix = np.argsort(-np.abs(correlation_matrix), axis=1)  # Descending rank

    # Compute Mutual Rank (MR)
    mutual_rank_matrix = np.zeros_like(correlation_matrix)
    for i in range(len(correlation_matrix)):
        for j in range(len(correlation_matrix)):
            if i != j:  # Exclude self-ranks
                R_i = rank_matrix[i, j]
                R_j = rank_matrix[j, i]
                mutual_rank_matrix[i, j] = np.sqrt((R_i + 1) * (R_j + 1))

    # Create adjacency matrix based on MR threshold
    threshold = int(thresh)
    adjacency_matrix = (mutual_rank_matrix < threshold).astype(int)
    np.fill_diagonal(adjacency_matrix, 0)

    # Create NetworkX graph
    G = nx.from_numpy_array(adjacency_matrix)
    labels = {i: gene for i, gene in enumerate(gene_expression.index)}
    G = nx.relabel_nodes(G, labels)
    
    # Get ALL genes from the expression matrix (not just connected ones)
    all_genes_in_network = list(gene_expression.index)
    
    # Fetch gene notes for ALL genes in the network
    gene_notes_queryset = GeneNote.objects.filter(Gene__in=all_genes_in_network).values('Gene', 'Note')
    gene_note_dict = {note['Gene']: note['Note'] for note in gene_notes_queryset}
    
    # Create gene notes list for ALL genes in network
    all_gene_notes = []
    for gene in all_genes_in_network:
        all_gene_notes.append({
            'Gene': gene,
            'Note': gene_note_dict.get(gene, '')  # Empty string if no note found
        })

    # Prepare filtered edges (for network visualization)
    filtered_edges = []
    cytoscape = ""
    for source, target in G.edges():
        source_idx = all_genes_in_network.index(source)
        target_idx = all_genes_in_network.index(target)
        mutual_rank = mutual_rank_matrix[source_idx, target_idx]
        filtered_edges.append({
            "data": {
                "source": source,
                "target": target,
                "directed": "false",
                "mutualRank": float(mutual_rank)
            }
        })
        cytoscape += f"{source}\tinteractsWith\t{target}\n"

    # Prepare nodes with notes and query flag for ALL genes in network
    nodes = []
    for gene in all_genes_in_network:
        node_data = {
            "data": {
                "id": gene,
                "isQuery": "true" if gene in query else "false",
                "note": gene_note_dict.get(gene, "")
            }
        }
        nodes.append(node_data)

    # Convert mutual_rank_matrix to list for JSON serialization
    mutual_rank_matrix_list = mutual_rank_matrix.tolist()

    return filtered_edges, nodes, mutual_rank_matrix_list, cytoscape, all_gene_notes
######################### Functional Gene Expression ################
def fexpression(cleaned_list,conditions,meta_df):
    # Fetch expression data
        expression = GeneData.objects.filter(Geneid__in=cleaned_list)
        df = pd.DataFrame(list(expression.values()))
        df = df.drop(columns=["id"])
        gene_expression = df.set_index('Geneid')
        
        # Prepare boxplot data
        box_plot = dict.fromkeys(conditions)
        for i in conditions:
            box_data = gene_expression.loc[:, meta_df.loc[meta_df['condition'] == i]["sample"].tolist()].transpose()
            box_plot[i] = list(box_data[cleaned_list])
        return box_data
##################################################################
def sGene(request):
    gene_id = request.GET.get('gene_id')  # Get the gene ID from the query parameters
    cleaned_list = gene_id.split()
    #print(cleaned_list)
    
    conditions = ["grain", "anthers", "seedlings", "Florets","panicle","leaf", "root", "stem"]
    metadata = MetaData.objects.filter(condition__in=conditions)
    meta_df = pd.DataFrame(list(metadata.values()))
    ## Mutual Rnak 
    mrank = MutualRank.objects.filter(Gene1__in=cleaned_list)
    mrank_df = pd.DataFrame(list(mrank.values()))
    cogenes = mrank_df["Gene2"].tolist() + cleaned_list
    #print(cogenes)
    ########## Note Data ##############
    gene_note = GeneNote.objects.filter(Gene__in=cleaned_list)
    gene_note_df = pd.DataFrame(list(gene_note.values()))

    #print(cogenes)
    if len(cogenes) > 1:
        coexpression = GeneData.objects.filter(Geneid__in=cogenes)
        codf = pd.DataFrame(list(coexpression.values()))
        codf= codf.drop(columns=["id"])
        co_gene_expression= codf.set_index('Geneid')
        edges, nodes, mutual_rank_matrix, cyt, gnote = pcc(co_gene_expression,100, cleaned_list)
        print(cyt)

    pfam_table = Pfam.objects.filter(Gene__in=cleaned_list)
    #print(pfam_table)
    
    if pfam_table:
        # Convert Pfam QuerySet to a list of dictionaries
        pfam_data = pd.DataFrame(list(pfam_table.values()))
        pfam_data = pd.merge(pfam_data, gene_note_df, left_on="Gene", right_on="Gene")
        pfam_data = pfam_data.to_dict(orient='records')
        
    frelate = list()
    for f in pfam_data:
        frelate.append(f['Pfma_acc'])
        #print(frelate)
    ftable = Pfam.objects.filter(Pfma_acc__in=frelate)
    
    ########## Note Data ##############
    f2_ftable = pd.DataFrame(list(ftable.values()))
    f2_genes = f2_ftable['Gene']
    gene_note_f = GeneNote.objects.filter(Gene__in=f2_genes)
    gene_note_df_f = pd.DataFrame(list(gene_note_f.values()))

    if ftable:
        f_data = pd.DataFrame(list(ftable.values()))
        #print(f_data)
        f_data = pd.merge(f_data, gene_note_df_f, left_on="Gene", right_on="Gene")
        f_data = f_data.to_dict(orient='records')
        #print(json.dumps(f_data))
    fgenes = list()
    
    for g in f_data:
        fgenes.append(g['Gene'])
    #print(fgenes)
    if len(fgenes) >= 1:
        fcoexpression = GeneData.objects.filter(Geneid__in=fgenes)
        fcodf = pd.DataFrame(list(fcoexpression.values()))
        fcodf= fcodf.drop(columns=["id"])
        fco_gene_expression= fcodf.set_index('Geneid')
        #print(fco_gene_expression)
        fedges, fnodes, fmutual_rank_matrix, fcyt, fgnote = pcc(fco_gene_expression,100,cleaned_list)
    if mrank:
        mrank_df = list(mrank.values())  
        # Format E-value in scientific notation
        for m in pfam_data:
            m['evalue'] = f"{float(m['evalue']):.2E}"
            frelate.append(m['Pfma_name'])
    
        # Fetch GO table data
        go_table = Gontology.objects.filter(Gene__in=cleaned_list)
        go_data = list(go_table.values())
        
        # Fetch expression data
        expression = GeneData.objects.filter(Geneid__in=cleaned_list)
        df = pd.DataFrame(list(expression.values()))
        df = df.drop(columns=["id"])
        gene_expression = df.set_index('Geneid')
        
        # Prepare boxplot data
        box_plot = dict.fromkeys(conditions)
        for i in conditions:
            box_data = gene_expression.loc[:, meta_df.loc[meta_df['condition'] == i]["sample"].tolist()].transpose()
            box_plot[i] = list(box_data[cleaned_list[0]])
        

        #################### Functional Related Expression ################
        f_expression = GeneData.objects.filter(Geneid__in=fgenes)
        f_df = pd.DataFrame(list(f_expression.values()))
        f_df = f_df.drop(columns=["id"])
        f_gene_expression = f_df.set_index('Geneid').transpose()
        #print(f_gene_expression)
        #print(f_gene_expression)
        # Prepare boxplot data
        f_box_data = f_gene_expression.reset_index().rename(columns={'index': 'ID'})
        f_box_data = pd.merge(f_box_data, meta_df, left_on='ID', right_on='sample')
        
        f_box_data = f_box_data.set_index("condition")
        f_box_data = f_box_data.drop(columns=["id", "sample", "ID"])
        #print(f_box_data)
        res = f_box_data.values.tolist()
        #print(res)
        series_names = list(f_box_data.columns[0:])
        rowSample = list(f_box_data.index)
        #print(series_names)
        #print(f_box_data["conditions"])
        # Prepare the response
        res_net = {
            'network' : edges,
            'nodes' : nodes,
            'gnote' : gnote,
            'cyto' : cyt,
            'fnetwork' : fedges,
            'fnodes' : fnodes,
            'fgnote' : fgnote,
            'fcyto' : fcyt,
            'conditions': list(box_plot.keys()),
            'boxplot': box_plot,
            'pfam': pfam_data,
            'gotable': go_data,
            'mrank': mrank_df,
            'funrelate' : f_data,
            'fexpression' : res,
            'series_names': series_names,
            'row_sample' : rowSample
        }
        
        # Return the response as JSON
        return JsonResponse(res_net)
    else:
        # Return an error response if no Pfam data is found
        return render(request, "single-gene.html")
############################################ Multiple Genes Search ########################################



#############################################################################################################
def network(request):
    gene_id = request.GET.get('genes-out')  # Get the gene ID from the query parameters
    #print(gene_id)
    cleaned_list = gene_id.split(",")
    #print(cleaned_list)
    pfam_table = Pfam.objects.filter(Gene__in=cleaned_list)
    mrank = MutualRank.objects.filter(Gene1__in=cleaned_list)
    mrank_df = pd.DataFrame(list(mrank.values()))
    cogenes = mrank_df["Gene2"].tolist() + cleaned_list
    #print(cogenes)
    if mrank:
        mrank_df = list(mrank.values())
        co_expression = GeneData.objects.filter(Geneid__in=cogenes)
        df_co = pd.DataFrame(list(co_expression.values()))
        df_co= df_co.drop(columns=["id"])
        co_gene_expression= df_co.set_index('Geneid')
        edges, nodes, mutual_rank_matrix, cyt, gnote = pcc(co_gene_expression,5, cleaned_list) 
        #f_co_edges, f_co_nodes, f_co_mutual_rank_matrix, f_co_cyt = pcc(co_gene_expression,100, cogenes) 
    ########## Note Data ##############
    gene_note = GeneNote.objects.filter(Gene__in=cleaned_list)
    gene_note_df = pd.DataFrame(list(gene_note.values()))
    
    if pfam_table:
        # Convert Pfam QuerySet to a list of dictionaries
        pfam_data = pd.DataFrame(list(pfam_table.values()))
        pfam_data = pd.merge(pfam_data, gene_note_df, left_on="Gene", right_on="Gene")
        pfam_data = pfam_data.to_dict(orient='records')
        #print(json.dumps(pfam_data))
        
        # Format E-value in scientific notation
        for m in pfam_data:
            m['evalue'] = f"{float(m['evalue']):.2E}"
    
    frelate = list()
    for f in pfam_data:
        frelate.append(f['Pfma_name'])
    ftable = Pfam.objects.filter(Pfma_name__in=frelate)
    

    if ftable:
        f_data = list(ftable.values())
    
    fgenes = list()
    
    for g in f_data:
        fgenes.append(g['Gene'])
    
    if len(fgenes) > 1:
        fcoexpression = GeneData.objects.filter(Geneid__in=fgenes+cogenes)
        fcodf = pd.DataFrame(list(fcoexpression.values()))
        fcodf= fcodf.drop(columns=["id"])
        fco_gene_expression= fcodf.set_index('Geneid')
        fedges, fnodes, fmutual_rank_matrix, fcyt, fgnote = pcc(fco_gene_expression,100, cleaned_list)
    expression = GeneData.objects.filter(Geneid__in=cleaned_list)
    df = pd.DataFrame(list(expression.values()))
    df= df.drop(columns=["id"])
    gene_expression= df.set_index('Geneid')
    
    edges_co, nodes_co, mutual_rank_matrix, cyt_co, gnote_co = pcc(gene_expression,5, cleaned_list)
    #################### Functional Related Expression ################
    conditions = ["grain", "anthers", "seedlings", "Florets","panicle","leaf", "root", "stem"]
    metadata = MetaData.objects.filter(condition__in=conditions)
    meta_df = pd.DataFrame(list(metadata.values()))
    f_expression = GeneData.objects.filter(Geneid__in=fgenes)
    f_df = pd.DataFrame(list(f_expression.values()))
    f_df = f_df.drop(columns=["id"])
    f_gene_expression = f_df.set_index('Geneid').transpose()
    #print(f_gene_expression)
    #print(f_gene_expression)
    # Prepare boxplot data
    f_box_data = f_gene_expression.reset_index().rename(columns={'index': 'ID'})
    f_box_data = pd.merge(f_box_data, meta_df, left_on='ID', right_on='sample')
    
    f_box_data = f_box_data.set_index("condition")
    f_box_data = f_box_data.drop(columns=["id", "sample", "ID"])
    #print(f_box_data)
    res = f_box_data.values.tolist()
    
    series_names = list(f_box_data.columns[0:])
    rowSample = list(f_box_data.index)
    expr_data = pd.DataFrame(res, columns=series_names)
    expr_data.index = rowSample
    expr_sum = expr_data.groupby(expr_data.index).sum()
    expr_sum.to_csv("query_genes.csv", index=True)
# Print nodes and edges in the requested format
#print("nodes:", nodes)
#print("edges:", edges)

    res_net = {
        'network' : edges,
        'nodes' : nodes,
        'gnote' : gnote,
        'q_cyt' : cyt_co,
        'fnetwork' : fedges,
        'fnodes' : fnodes,
        'gnote_co' : fgnote,
        'fcyt' : fcyt,
        'genes': pfam_data,
        'rank': mutual_rank_matrix,
        'mrank': mrank_df,
        'network_co': edges_co, # original network for query genes
        'nodes_co':nodes_co, # original network for query genes
        'fgnote':gnote_co,
        'fexpression' : res,
        'series_names': series_names,
        'row_sample' : rowSample
    }
    
    return JsonResponse(res_net)

################################## Upload Data ##############################

def upload(request):
    if request.method == "POST":
        csv_file = request.FILES.get("file", False)
        metadata = request.FILES.get("file2", False)
        file_pfam = request.FILES.get("file3", False)
        file_go = request.FILES.get("file4", False)
        if metadata:
            file_data = pd.read_csv(metadata)
            for index, row in file_data.iterrows():
                bam_data, created = MetaData.objects.update_or_create(
                    sample = row['sample'],
                    condition = row['condition']
                )
            return HttpResponse("Meta data uploaded")
        else:
            print("metadata not uploaded")
        if file_pfam:
            pfam_data = pd.read_csv(file_pfam)
            for index, row in pfam_data.iterrows():
                bam_data, created = Pfam.objects.update_or_create(
                    Gene = row['gene'],
                    mRNA = row['model'],
                    Pfma_acc = row['hmm_acc'],
                    Pfma_name = row['hmm_name'],
                    Pfma_type = row['hmm_type'],
                    evalue = row['evalue']
                )
            return HttpResponse("Pfam data uploaded")
        else:
            print("Pfam not uploaded")
        if file_go:
            go_data = pd.read_csv(file_go,on_bad_lines='skip')
            for index, row in go_data.iterrows():
                bam_data, created = Gontology.objects.update_or_create(
                    Gene = row['gene'],
                    mRNA = row['model'],
                    GO_acc = row['acc'],
                    GO_name = row['name'],
                    GO_type = row['type']
                )
            return HttpResponse("GO data uploaded")
        else:
            print("GO not uploaded")
        if csv_file:
            decoded_file = pd.read_csv(csv_file)
            for index, row in decoded_file.iterrows():
                bam_data, created = GeneData.objects.update_or_create(
                    Geneid=row['Geneid'],
                    defaults={
                        'SRR11484242': row.get('SRR11484242', 0.0),
                        'SRR11484243': row.get('SRR11484243', 0.0),
                        'SRR11484244': row.get('SRR11484244', 0.0),
                        'SRR11484245': row.get('SRR11484245', 0.0),
                        'SRR11484246': row.get('SRR11484246', 0.0),
                        'SRR11484247': row.get('SRR11484247', 0.0),
                        'SRR11484248': row.get('SRR11484248', 0.0),
                        'SRR11484249': row.get('SRR11484249', 0.0),
                        'SRR15186046': row.get('SRR15186046', 0.0),
                        'SRR15186047': row.get('SRR15186047', 0.0),
                        'SRR15186048': row.get('SRR15186048', 0.0),
                        'SRR15186049': row.get('SRR15186049', 0.0),
                        'SRR15186050': row.get('SRR15186050', 0.0),
                        'SRR15186051': row.get('SRR15186051', 0.0),
                        'SRR15186052': row.get('SRR15186052', 0.0),
                        'SRR15186053': row.get('SRR15186053', 0.0),
                        'SRR16964287': row.get('SRR16964287', 0.0),
                        'SRR16964288': row.get('SRR16964288', 0.0),
                        'SRR16964289': row.get('SRR16964289', 0.0),
                        'SRR16964290': row.get('SRR16964290', 0.0),
                        'SRR16964291': row.get('SRR16964291', 0.0),
                        'SRR16964292': row.get('SRR16964292', 0.0),
                        'SRR16964293': row.get('SRR16964293', 0.0),
                        'SRR16964294': row.get('SRR16964294', 0.0),
                        'SRR16964295': row.get('SRR16964295', 0.0),
                        'SRR16964296': row.get('SRR16964296', 0.0),
                        'SRR16964297': row.get('SRR16964297', 0.0),
                        'SRR16964298': row.get('SRR16964298', 0.0),
                        'SRR16964299': row.get('SRR16964299', 0.0),
                        'SRR16964300': row.get('SRR16964300', 0.0),
                        'SRR16964301': row.get('SRR16964301', 0.0),
                        'SRR16964302': row.get('SRR16964302', 0.0),
                        'SRR16964303': row.get('SRR16964303', 0.0),
                        'SRR16964304': row.get('SRR16964304', 0.0),
                        'SRR17278530': row.get('SRR17278530', 0.0),
                        'SRR17278531': row.get('SRR17278531', 0.0),
                        'SRR17278532': row.get('SRR17278532', 0.0),
                        'SRR17278533': row.get('SRR17278533', 0.0),
                        'SRR17278534': row.get('SRR17278534', 0.0),
                        'SRR17278535': row.get('SRR17278535', 0.0),
                        'SRR17278536': row.get('SRR17278536', 0.0),
                        'SRR17278537': row.get('SRR17278537', 0.0),
                        'SRR17278538': row.get('SRR17278538', 0.0),
                        'SRR17278539': row.get('SRR17278539', 0.0),
                        'SRR17278540': row.get('SRR17278540', 0.0),
                        'SRR17872080': row.get('SRR17872080', 0.0),
                        'SRR17872081': row.get('SRR17872081', 0.0),
                        'SRR17872082': row.get('SRR17872082', 0.0),
                        'SRR17872083': row.get('SRR17872083', 0.0),
                        'SRR17872084': row.get('SRR17872084', 0.0),
                        'SRR17872085': row.get('SRR17872085', 0.0),
                        'SRR17872086': row.get('SRR17872086', 0.0),
                        'SRR17872087': row.get('SRR17872087', 0.0),
                        'SRR17872088': row.get('SRR17872088', 0.0),
                        'SRR17872089': row.get('SRR17872089', 0.0),
                        'SRR17872090': row.get('SRR17872090', 0.0),
                        'SRR17872091': row.get('SRR17872091', 0.0),
                        'SRR17872092': row.get('SRR17872092', 0.0),
                        'SRR17872093': row.get('SRR17872093', 0.0),
                        'SRR17872094': row.get('SRR17872094', 0.0),
                        'SRR17872095': row.get('SRR17872095', 0.0),
                        'SRR17872096': row.get('SRR17872096', 0.0),
                        'SRR17872097': row.get('SRR17872097', 0.0),
                        'SRR17872098': row.get('SRR17872098', 0.0),
                        'SRR17872099': row.get('SRR17872099', 0.0),
                        'SRR17872100': row.get('SRR17872100', 0.0),
                        'SRR17872101': row.get('SRR17872101', 0.0),
                        'SRR17872102': row.get('SRR17872102', 0.0),
                        'SRR17872103': row.get('SRR17872103', 0.0),
                        'SRR17872104': row.get('SRR17872104', 0.0),
                        'SRR17872105': row.get('SRR17872105', 0.0),
                        'SRR17872106': row.get('SRR17872106', 0.0),
                        'SRR17872107': row.get('SRR17872107', 0.0),
                        'SRR17872108': row.get('SRR17872108', 0.0),
                        'SRR17872109': row.get('SRR17872109', 0.0),
                        'SRR17872110': row.get('SRR17872110', 0.0),
                        'SRR17872111': row.get('SRR17872111', 0.0),
                        'SRR17872112': row.get('SRR17872112', 0.0),
                        'SRR17872113': row.get('SRR17872113', 0.0),
                        'SRR17872114': row.get('SRR17872114', 0.0),
                        'SRR17872115': row.get('SRR17872115', 0.0),
                        'SRR17901768': row.get('SRR17901768', 0.0),
                        'SRR17901769': row.get('SRR17901769', 0.0),
                        'SRR17901770': row.get('SRR17901770', 0.0),
                        'SRR17901771': row.get('SRR17901771', 0.0),
                        'SRR17901772': row.get('SRR17901772', 0.0),
                        'SRR17901773': row.get('SRR17901773', 0.0),
                        'SRR17901774': row.get('SRR17901774', 0.0),
                        'SRR17901775': row.get('SRR17901775', 0.0),
                        'SRR17901776': row.get('SRR17901776', 0.0),
                        'SRR17901777': row.get('SRR17901777', 0.0),
                        'SRR17901778': row.get('SRR17901778', 0.0),
                        'SRR17901779': row.get('SRR17901779', 0.0),
                        'SRR28195857': row.get('SRR28195857', 0.0),
                        'SRR28195864': row.get('SRR28195864', 0.0),
                        'SRR28195868': row.get('SRR28195868', 0.0),
                        'SRR28195872': row.get('SRR28195872', 0.0),
                        'SRR28195877': row.get('SRR28195877', 0.0),
                        'SRR28195878': row.get('SRR28195878', 0.0),
                        'SRR28195884': row.get('SRR28195884', 0.0),
                        'SRR28195888': row.get('SRR28195888', 0.0),
                        'SRR28195892': row.get('SRR28195892', 0.0),
                        'SRR28195896': row.get('SRR28195896', 0.0),
                        'SRR28195900': row.get('SRR28195900', 0.0),
                        'SRR28195904': row.get('SRR28195904', 0.0),
                        'SRR28195908': row.get('SRR28195908', 0.0),
                        'SRR28195915': row.get('SRR28195915', 0.0),
                        'SRR28195921': row.get('SRR28195921', 0.0),
                        'SRR28195925': row.get('SRR28195925', 0.0),
                        'SRR28195926': row.get('SRR28195926', 0.0),
                        'SRR28195929': row.get('SRR28195929', 0.0),
                        'SRR28195933': row.get('SRR28195933', 0.0),
                        'SRR28195936': row.get('SRR28195936', 0.0),
                        'SRR28195940': row.get('SRR28195940', 0.0),
                        'SRR28195944': row.get('SRR28195944', 0.0),
                        'SRR28195948': row.get('SRR28195948', 0.0),
                        'SRR28195952': row.get('SRR28195952', 0.0),
                        'SRR28195956': row.get('SRR28195956', 0.0),
                        'SRR28195960': row.get('SRR28195960', 0.0),
                        'SRR28195964': row.get('SRR28195964', 0.0),
                        'SRR28195968': row.get('SRR28195968', 0.0),
                        'SRR28195972': row.get('SRR28195972', 0.0),
                        'SRR28195976': row.get('SRR28195976', 0.0),

                    }
                )

            return HttpResponse("CSV file uploaded and data saved successfully!")
        else:
            print("not uploaded")
        
    return render(request, "upload.html")