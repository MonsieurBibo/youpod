/*fetch("/admin/queue", {
    method: "PUT",
    headers : {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({id: game_id, data: data})
})*/

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