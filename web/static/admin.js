function flushVideo() {
    fetch("/admin/action", {
        method: "POST",
        headers : {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({action: "flush_video"})
    }).then(() => {
        window.location.reload()
    })
}

function flushList() {
    fetch("/admin/action", {
        method: "POST",
        headers : {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({action: "flush_list"})
    }).then(() => {
        window.location.reload()
    })
}

fetch("/admin/queue")
    .then((data) => {
        return data.json()
    })
    .then((json) => {
        console.log(json)
        table = document.getElementById("queue")

        json.queue.forEach((v) => {
            row = table.insertRow()
            row.insertCell().innerHTML = v.id
            row.insertCell().innerHTML = v.rss != "__custom__" ? v.rss : v.title
            row.insertCell().innerHTML = v.email
            row.insertCell().innerHTML = `<form action="/admin/prio/${v.id}" method="post"><input type="number" name="priority" value="${v.priority}" required /><input type="submit" value="Changer" /></form>`
        })
    })