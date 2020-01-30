const path = require("path");

module.exports = {
    path_evalute: (arg_path) => {
        if (path.isAbsolute(arg_path)) {
            return arg_path
        } else {
            return path.join(__dirname, arg_path)
        }
    }
}