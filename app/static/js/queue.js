var queued = false;
var matchFromQueueInterval;

const evtSource = new EventSource('/play/request_match_from_queue')

function sendJSON(){
    let move = document.querySelector('#move');
    let url = "/play/move_handler";

    var data = JSON.stringify({ "move" : move.value });

    fetch(url, {
        "method" : "POST",
        "headers" : {"Content-Type" : "application/json"},
        "body" : JSON.stringify(data)
    });
}

function receiveJSON(){
    let url = "/play/move_handler";

    var move = fetch(url).then(response => response.json()).then(data => {
        console.log(data["move"]);
        document.getElementById("result").innerHTML = data["move"];
    });
}

function getMatchFromQueue(){
    let url = '/play/request_match_from_queue'

    console.log("Requesting match");
    fetch(url).then(response => response.json()).then(data => {
        if (data["match_found"] == true) {
            let url = data["match_url"];
            console.log(url);
            window.location.href = url;
        }
    });
}

function addClientToQueue(){
    let url = "/play/queue_handler";

    var data = JSON.stringify({"queue" : "add" });

    fetch(url, {
        "method" : "POST",
        "headers" : {"Content-Type" : "application/json"},
        "body" : JSON.stringify(data)
    })
    .then(document.getElementById("queue-btn").innerHTML = "Leave Queue")
    .then(queued = true);

    matchFromQueueInterval = setInterval(getMatchFromQueue, 6000);

}

function removeClientFromQueue(){
    // Check if queued as we call this function on unload
    if (queued == false){
        return;
    }
    let url = "/play/queue_handler";

    var data = JSON.stringify({"queue" : "remove" });

    fetch(url, {
        "method" : "POST",
        "headers" : {"Content-Type" : "application/json"},
        "body" : JSON.stringify(data)
    })
    .then(clearInterval(matchFromQueueInterval))
    .then(document.getElementById("queue-btn").innerHTML = "Join Queue")
    .then(queued = false);
}

function toggleQueue(){
    if (queued == false){
        addClientToQueue();
        return;
    }
    removeClientFromQueue();
}