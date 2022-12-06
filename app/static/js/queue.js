let queued = false;
let matchFromQueueInterval;

const evtSource = new EventSource("/play/request_match_from_queue");

function getMatchFromQueue() {
  const url = "/play/request_match_from_queue";

  console.log("Requesting match");
  fetch(url).then((response) => response.json()).then((data) => {
    if (data["match_found"] == true) {
      const url = data["match_url"];
      console.log(url);
      window.location.href = url;
    }
  });
}

function addClientToQueue() {
  const url = "/play/queue_handler";

  const data = JSON.stringify({ "queue": "add" });

  fetch(url, {
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "body": JSON.stringify(data),
  })
    .then(document.getElementById("queue-btn").innerHTML = "Leave Queue")
    .then(queued = true);

  matchFromQueueInterval = setInterval(getMatchFromQueue, 1000);
}

function removeClientFromQueue() {
  // Check if queued as we call this function on unload
  if (queued == false) {
    return;
  }
  const url = "/play/queue_handler";

  const data = JSON.stringify({ "queue": "remove" });

  fetch(url, {
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "body": JSON.stringify(data),
  })
    .then(clearInterval(matchFromQueueInterval))
    .then(document.getElementById("queue-btn").innerHTML = "Join Queue")
    .then(queued = false);
}

function toggleQueue() {
  if (queued == false) {
    addClientToQueue();
    return;
  }
  removeClientFromQueue();
}

