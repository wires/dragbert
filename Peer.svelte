<script>
import { writable } from "svelte/store";


let peer = new Peer() // 🍐
let myId = false
let otherPeer;

let username = false

$: isConnected = myId !== false

let peertjes = writable({})

function updatePeer(id, data) {
  let peers = $peertjes
  peers[id] = data
  $peertjes = peers
}

function start(usrName) {
  username = usrName

  peer.on('open', id => {
    myId = id
  })

  peer.on('connection', conn => {
    updatePeer(conn.peer, {peer:conn.peer})
    conn.on('data', function(data) {
      if(data.hiMyNameIs) {
        updatePeer(conn.peer, {
          peer:conn.peer,
          name: data.hiMyNameIs
        })
      }
      console.log('Received', data);
    });
    conn.send('hi back')
  })
}

function addPeer(conn) {

}

function connect() {
  if (otherPeer == false) {
    return
  }
  var conn = peer.connect(otherPeer)
  // on open will be launch when you successfully connect to PeerServer
  conn.on('open', function(){
    updatePeer(conn.peer, {peer:conn.peer})
    // here you have conn.id
    conn.send({hiMyNameIs: username})
  });
}

function keydown(evt) {
  if (evt.keyCode == 13) {
    connect()
  }
}

function setUsername(evt) {
  if (evt.keyCode == 13) {
    start(newName)
  }
}

start()

let newName

</script>

<div class="peer2peer">
  <span class="user-selectable: none">🍐</span>
  <span>
    {#if username}
    {#if isConnected}
    <span class="my-id"><code>{myId}</code></span>
    <span><input type="text" style="width: 14em;" placeholder="enter peer address to connect" bind:value={otherPeer} on:keydown={keydown}></span>
    <br/>
    {#each Object.values($peertjes) as peer}
    <span>{peer.peer}</span>
    {/each}
    {:else}
    *connecting*
    {/if}
    {:else}
    <input type="text" bind:value={newName} style="width: 4em;" on:keydown={setUsername}><i>*enter your initials/name</i>
    {/if}
  </span>
</div>

<pre>{JSON.stringify($peertjes,null,2)}</pre>

<style>
  .peer2peer {
    background-color: olivedrab;
    color: white;
  }
  .my-id {
    font-weight: bold;
    padding: 3px;
  }
</style>