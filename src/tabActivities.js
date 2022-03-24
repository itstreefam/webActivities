const Graph = require('graphology');

module.exports = class tabActivities {
    constructor(){
        // directed graph
        this.graph_ = new Graph({type: 'directed', multi: true, allowSelfLoops: true});
    }

    initRootNode(url){
        if(this.graph_.order === 0){
            this.graph_.addNode(url);
        }
    }

    addUrlConnection(url1, url2, tabId){
        // check if url1 is in the graph
        if(!this.graph_.hasNode(url1) && url1 !== ""){
            this.graph_.addNode(url1);
        }
        // check if url2 is in the graph
        if(!this.graph_.hasNode(url2) && url2 !== ""){
            this.graph_.addNode(url2);
        }
        // check if url1 and url2 are connected
        if(!this.graph_.hasEdge(url1, url2) && url1 !== "" && url2 !== ""){
            this.graph_.addEdge(url1, url2, {weight: tabId});
        }
    }

    getGraph(){
        return this.graph_;
    }
}