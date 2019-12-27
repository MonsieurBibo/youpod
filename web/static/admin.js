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
        table2 = document.getElementById("during")

        json.queue.forEach((v) => {
            row = table.insertRow()
            row.insertCell().innerHTML = v.id
            row.insertCell().innerHTML = v.rss != "__custom__" ? v.rss : v.title
            row.insertCell().innerHTML = v.email
            row.insertCell().innerHTML = createForm(v)
        })

        json.during.forEach((v) => {
            row = table2.insertRow()
            row.insertCell().innerHTML = v.id
            row.insertCell().innerHTML = v.rss != "__custom__" ? v.rss : v.title
            row.insertCell().innerHTML = v.email
        })
    })

function submitPrio(id) {
    document.getElementById("prio_" + id).submit()
}

function submitForm() {
    if (confirm("Valider ces informations?")) {
        document.getElementById("form_option").submit()
    }
}

function createForm(v) {
    return `
        <form id="prio_${v.id}" action="/admin/prio/${v.id}" method="post">
            <select name="priority" id="priority-select" onchange="submitPrio(${v.id})">
                <option ${v.priority == 0 ? "selected" : ""} value="0">Normale</option>
                <option ${v.priority == -1 ? "selected" : ""} value="-1">Basse</option>
                <option ${v.priority == 1 ? "selected" : ""} value="1">Elevée</option>
            </select>
        </form>
    `
}