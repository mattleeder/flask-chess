class ArraySet extends Set {
    add(arr) {
      super.add(arr.toString());
    }
    has(arr) {
      return super.has(arr.toString());
    }
  }

// Warn if overriding existing method
if(Array.prototype.equals) {
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
}
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array) {
        return false;
    }

    // compare lengths - can save a lot of time 
    if (this.length != array.length) {
        return false;
    }

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i])) {
                return false;       
            }
        }           
        else if (this[i] != array[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    }       
    return true;
}
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", {enumerable: false});

// Warn if overriding existing method
// This function is only designed to check if an array contains another given array
// Designed for checking if pieces contain certain moves
if(Array.prototype.contains)
    console.warn("Overriding existing Array.prototype.contains. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .contains method to Array's prototype to call it on any array
Array.prototype.contains = function (array) {
    if (!array) {
        return false;
    }

    // for each element check if it is equal to our given array
    for (let i = 0; i < this.length; i++) {
        if (this[i].equals(array)) {
            return true;
        }
    }
    return false;
}
  
var myGamePiece;
var myObstacles = [];
var myScore;
var queued = false;
var enpassantStack = [];
var enpassantCapture = null;
var selectedPiece = false;
var board;
var pieceManager;
var promotionWindowActive = false;
var promotionWindowArea = new ArraySet();
var moveInProcess = [];
const drawnMoves = new ArraySet();
const pinnableVectors = new ArraySet();
const attackingKing = {
    "White" : new Set(),
    "Black" : new Set()
}
var validCheckDefenses = new ArraySet();
pinnableVectors.add([0, 1]);
pinnableVectors.add([1, 1]);
pinnableVectors.add([1, 0]);
pinnableVectors.add([1, -1]);
pinnableVectors.add([0, -1]);
pinnableVectors.add([-1, -1]);
pinnableVectors.add([-1, 0]);
pinnableVectors.add([-1, 1]);
const pieceImage = document.getElementById("piece-image");
const canvasDimension = 480;
const pieceImgDimension = canvasDimension / 8;
const sy = {
    "Black" : 0,
    "White" : pieceImgDimension
};
const sx = {
    "Queen" : 0,
    "King" : pieceImgDimension,
    "Rook" : pieceImgDimension * 2,
    "Knight" : pieceImgDimension * 3,
    "Bishop" : pieceImgDimension * 4,
    "Pawn" : pieceImgDimension * 5,
};

const bishopMoves = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1]
];
    
const knightMoves = [
    [1, 2],
    [2, 1],
    [-1, 2],
    [-2, 1],
    [1, -2],
    [2, -1],
    [-1, -2],
    [-2, -1]
];

const rookMoves = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1]
];

const pawnMoves = {
    "White" : [[0, 1]],
    "Black" : [[0, -1]]
};

const queenMoves = [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
    [-1, -1]
];

const kingMoves = [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
    [-1, -1]
];

function* generator() {
    while (true) {
        if (turn == "White") {
            yield "Black";
        }
        else {
            yield "White";
        }
    }
}

const turnGenSend = generator();
const turnGenLocal = generator();

function directionVector(pointA, pointB) {
    return [pointB[0] - pointA[0], pointB[1] - pointA[1]];
}

function chessUnitDirectionVector(pointA, pointB) {
    vector = directionVector(pointA, pointB);
    divisor = Math.max(Math.abs(vector[0]), Math.abs(vector[1]));
    return [vector[0] / divisor, vector[1] / divisor];
}

function isPinnableVector(vector) {
    return pinnableVectors.has(vector);
}

function addVector(vectorA, vectorB) {
    return [vectorA[0] + vectorB[0], vectorA[1] + vectorB[1]];
}

function scaleVector(vector, scalar) {
    return [vector[0] * scalar, vector[1] * scalar];
}

class OutOfBoundsError extends Error {
    constructor(message) {
        super(message);
        this.name = "OutOfBoundsError";
    }
}

class Piece {

    constructor(colour, position, gameArea, has_moved = false) {
        if (new.target === Piece) {
            throw new TypeError("Piece instance cannot be constructed directly")
        }
        this.colour = colour;
        this.rank = this.constructor.name;
        this.position = position; // [row, col]
        this.gameArea = gameArea;
        this.has_moved = has_moved;

        // These must be defined in the subclasses
        // this.moves = null;
        // this.range = null;
        // this.can_promote = null;
    }

    setPieceManager(newManager) {
        this.pieceManager = newManager;
    }

    set position(newPosition) {
        if (newPosition.length !== 2) {
            throw `Position must be length 2`;
        }
        else if (Math.max(...newPosition) > 7 || Math.min(...newPosition) < 0){
            throw new OutOfBoundsError(`${newPosition} out of Bounds, must be (0, 0) to (8, 8)`);
        }
        this._position = newPosition;
    }

    get position() {
        return this._position;
    }

    get row() {
        return this._position[0];
    }

    get col() {
        return this._position[1]
    }

    repr() {
        return `${this.constructor.name}(${this.colour}, [${this._position}])`
    }

    str() {
        return `${this.colour} ${this.rank} at ${this.position}`;
    }

    draw() {
        this.gameArea.canvas.getContext("2d").drawImage(
            pieceImage, sx[this.rank], sy[this.colour], pieceImgDimension, pieceImgDimension, this.row * pieceImgDimension, ((7 - this.col) * pieceImgDimension),
            pieceImgDimension, pieceImgDimension
        );
    }

    promote(row, col) {
        // All pieces will call this, so if a piece cant promote then it will do nothing
        return;
    }

    calculateMoves() {

        let [validMoves, validCaptures, defending] = this.moveLoop();

        let illegalMoves;
        let legalMoves;

        let legalCaptures;
        let illegalCaptures;

        if (!(this.rank == "King") && this.isPinned()) {
            console.log(`${this.str()} is pinned`);

            [legalMoves, illegalMoves] = this.pinnedValidation(validMoves);
            [legalCaptures, illegalCaptures] = this.pinnedValidation(validCaptures);

            defending.concat(illegalMoves);
            defending.concat(illegalCaptures);

            validMoves = legalMoves;
            validCaptures = legalCaptures;
        }

        if (this.pieceManager.king[this.colour].inCheck()) {
            [validMoves, illegalMoves] = this.checkValidation(validMoves);
            [validCaptures, illegalCaptures] = this.checkValidation(validCaptures);
            defending = defending.concat(illegalMoves, illegalCaptures);
        }

        return [validMoves, validCaptures, defending];
    }

    checkValidation(moves) {
        /*Take moves and make sure they are valid given check status of friendly king
        Returns valid_moves, invalid_moves*/
        
        let validMoves = [];
        let invalidMoves = [];
        console.log(attackingKing);
        let attacker = Array.from(attackingKing[this.colour])[0];
        console.log(`Attacker is: ${attacker.str()}`);

        if (this.rank == "King") {
            return [moves, invalidMoves];
        }
        if (this.pieceManager.king[this.colour].inCheck()) {
            // If in double check, only King can move
            if (attackingKing[this.colour].size == 2) {
                invalidMoves = [...moves];
                return [[], invalidMoves];
            }
            // If only 1 piece attacking king, next move must block piece, capture piece or move king
            else {
                moves.forEach(move => {
                    if (validCheckDefenses.has(move)) {
                        validMoves.push(move);
                    }
                    // Check if enpassant can be used to capture attacker
                    else if(attacker.rank == "Pawn" && enpassantCapture.equals([attacker.position[0], attacker.position[1] + this.moves[0][1]])) {
                        if (!(validMoves.contains([enpassantCapture]))) {
                            validMoves.push(enpassantCapture);
                        }
                    }
                    else {
                        invalidMoves.push(move);
                    }
                })
            }
        }

        return [validMoves, invalidMoves];
    }

    moveLoop() {
        let validMoves = [];
        let validCaptures = [];
        let defending = [];

        this.moves.forEach(move => {
            let magnitude = 1;
            while (magnitude <= this.range) {
                let considerationPosition = addVector(this.position, scaleVector(move, magnitude));
                 // # Ignore if position not on board
                if (Math.max(...considerationPosition) > 7 || Math.min(...considerationPosition) < 0) {
                    break;
                }
                // # If square if empty, add to moves, if occupied by enemy add to captures, otherwise break
                let piece = this.pieceManager.squares[considerationPosition[0]][considerationPosition[1]].piece;
                if (!piece) {
                    validMoves.push(considerationPosition);
                }
                else if (this.colour != piece.colour) {
                    if (piece.rank != "King") {
                        validCaptures.push(considerationPosition);
                        break;
                    }
                    // If piece is enemy king, add squares behind the king to defending
                    defending.push(considerationPosition);
                    let enemyColour = "White";
                    if (this.colour == "White") {
                        enemyColour = "Black";
                    }

                    // Keep track of pieces attacking kings
                    attackingKing[enemyColour].add(this);
                    console.log(`Adding ${this.str()} to attackingKing`);

                    while (true) {
                        let magnitudeCopy = magnitude + 1;
                        considerationPosition = addVector(this.position, scaleVector(move, magnitudeCopy));
                        if (Math.max(...considerationPosition) > 7 || Math.min(...considerationPosition) < 0) {
                            break;
                        }
                        piece = this.pieceManager.squares[considerationPosition[0]][considerationPosition[1]].piece;
                        // If no piece, add square to defending then continue
                        if (!piece) {
                            defending.push(considerationPosition);
                        }
                        // If piece and same colour, add to defending then break
                        else if (piece.colour == this.colour) {
                            defending.append(considerationPosition);
                            break;
                        }
                        // Else break
                        break;
                    }
                    break;
                }

                else {
                    defending.push(considerationPosition);
                    break;
                }
                magnitude += 1;
            }
        })


        return [validMoves, validCaptures, defending];
    }

    isPinned() {
        /*Returns true if piece is pinned to friendly king, take care though
        as a pinned piece can still move along the pinned axis or capture attacking piece,
        could get round this by using temporary replacement of moves dict?*/

        let kingPos = this.pieceManager.king[this.colour].position;
        let directionFromKing = chessUnitDirectionVector(kingPos, this.position);
        if (!isPinnableVector(directionFromKing)) {
            return false;
        }

        let vectorFromKing = [Math.floor(directionFromKing[0]), Math.floor(directionFromKing[1])];
        let vectorToKing = [vectorFromKing[0] * -1, vectorFromKing[1] * -1];

        // Check for piece in between current piece and king
        let magnitude = 1;
        while(true) {
            let considerationPosition = addVector(this.position, scaleVector(vectorToKing, magnitude));
            let piece = this.pieceManager.squares[considerationPosition[0]][considerationPosition[1]].piece;
            if (considerationPosition.equals(kingPos)) { // Is king
                break;
            }
            else if (!piece) {
                magnitude += 1;
                continue;
            }
            else {
                return false;
            }
        }

        // Check for enemy piece along checking axis
        magnitude = 1;
        while(true) {
            let considerationPosition = addVector(this.position, scaleVector(vectorFromKing, magnitude));
            if (Math.max(...considerationPosition) > 7 || Math.min(...considerationPosition) < 0) {
                return false;
            }
            let piece = this.pieceManager.squares[considerationPosition[0]][considerationPosition[1]].piece;
            if (!piece) {
                magnitude += 1;
                continue;
            }
            else if (piece.colour == this.colour) {
                return false;
            }
            else if (["King", "Pawn", "Knight"].includes(piece.rank)) {
                return false;
            }
            else if (!(piece.moves.contains(vectorToKing))) {
                return false;
            }
            return true;
        }

    }

    pinnedValidation(moves) {

        let kingPos = this.pieceManager.king[this.colour].position;
        let vectorFromKing = chessUnitDirectionVector(kingPos, this.position);
        let vectorToKing = [vectorFromKing[0] * -1, vectorFromKing[1] * -1];

        let validMoves = [];
        let notValidMoves = [];
        let moveDirection;

        moves.forEach(move => { 
            moveDirection = chessUnitDirectionVector(this.position, move);
            if (moveDirection.equals(vectorFromKing) || moveDirection.equals(vectorToKing)) {
                validMoves.push(move);
            }
            else {
                notValidMoves.push(move);
            }
        })

        return [validMoves, notValidMoves];
    }

    checkDefenses() {
        validCheckDefenses.clear();
    
        let enemyColour = "White";
        if (this.colour == "White") {
            enemyColour = "Black";
        }

        let kingPiece = this.pieceManager.king[enemyColour];
        if (kingPiece.inCheck()) {
            if (attackingKing[enemyColour].size == 1) {
                let attacker = Array.from(attackingKing[enemyColour])[0];
                console.log(`Attacker is ${attacker.str()}`);
                let direction = chessUnitDirectionVector(attacker.position, kingPiece.position);
                console.log(`Adding ${attacker.position} to validCheckDefenses`);
                validCheckDefenses.add(attacker.position);
                let magnitude = 1;
                while (true) {
                    let newMove = addVector(attacker.position, scaleVector(direction, magnitude));
                    if (attacker.rank == "Knight") { // Knight will be attacking king on magnitude = 1
                        break;
                    }
                    if (this.pieceManager.squares[newMove[0]][newMove[1]].piece) {
                        break;
                    }
                    validCheckDefenses.add(newMove);
                    magnitude += 1;
                }
            }
        }

        this.pieceManager.checkmateCalculator(enemyColour);
        return true;
    }

    select() {
        let allMoves = this.calculateMoves();
        let moves = allMoves[0];
        let captures = allMoves[1];
        let ctx = this.gameArea.canvas.getContext("2d");
        ctx.fillStyle = "black";
        moves.forEach(move => {
            ctx.beginPath();
            ctx.arc(move[0] * pieceImgDimension + pieceImgDimension / 2, (7 - move[1]) * pieceImgDimension + pieceImgDimension / 2, pieceImgDimension / 2, 0, 2 * Math.PI);
            ctx.stroke();
            drawnMoves.add(move);
        });
        ctx.fillStyle = "red";
        captures.forEach(move => {
            ctx.beginPath();
            ctx.arc(move[0] * pieceImgDimension + pieceImgDimension / 2, (7 - move[1]) * pieceImgDimension + pieceImgDimension / 2, pieceImgDimension / 2, 0, 2 * Math.PI);
            ctx.stroke();
            drawnMoves.add(move);
        });
    }
}

class Bishop extends Piece {

    constructor(colour, arr, gameArea, has_moved = false) {
        super(colour, arr, gameArea, has_moved);
        this.moves = bishopMoves;
        this.range = 8;
        this.can_promote = false;
    }
}

class Knight extends Piece {

    constructor(colour, arr, gameArea, has_moved = false) {
        super(colour, arr, gameArea, has_moved);
        this.moves = knightMoves;
        this.range = 1;
        this.can_promote = false;
    }
}

class Rook extends Piece {

    constructor(colour, arr, gameArea, has_moved = false) {
        super(colour, arr, gameArea, has_moved);
        this.moves = rookMoves;
        this.range = 8;
        this.can_promote = false;
    }
}

class Queen extends Piece {

    constructor(colour, arr, gameArea, has_moved = false) {
        super(colour, arr, gameArea, has_moved);
        this.moves = queenMoves;
        this.range = 8;
        this.can_promote = false;
    }
}

class King extends Piece {

    constructor(colour, arr, gameArea, has_moved = false) {
        super(colour, arr, gameArea, has_moved);
        this.moves = kingMoves;
        this.range = 1;
        this.can_promote = false;
    }

    inCheck() {
        let enemyColour = "White";
        if (this.colour == "White") {
            enemyColour = "Black";
        }
        return this.pieceManager.squares[this.position[0]][this.position[1]].control[enemyColour];
    }

    moveLoop() {
        /*Loops through moveset and calculates possible moves or captures for the piece
        as well as squares it is defending but can't move to (e.g. defending friendly piece)*/

        let [moves, captures, defending] = super.moveLoop();

        let enemyColour = "White";

        if (this.colour == "White") {
            enemyColour = "Black";
        }

        // Validate moves and captures

        moves = this.moveValidation(moves, enemyColour);
        captures = this.moveValidation(captures, enemyColour);

        if (this.inCheck()) {
            console.log(`${this.str()} in check`);
        }
        if (this.has_moved || this.inCheck()) {
            return [moves, captures, defending];
        }

        // Castling
        // Check if left rook has moved
        // Check if no pieces between king and left rook
        // Check if no enemy square control between king and left rook
        // Repeat for right rook

        // Left rook
        let leftRookPosition = [this.position[0] - 4, this.position[1]];
        let leftRook = this.pieceManager.squares[leftRookPosition[0]][leftRookPosition[1]].piece;

        let leftRookCanCastle = true;

        if (leftRook && !(leftRook.has_moved)) {
            for (let j = 1; j < 4; j++) {
                let square = this.pieceManager.squares[this.position[0] - j][this.position[1]];
                // If piece in the way or moving through check, cannot castle
                if (square.piece || square.control[enemyColour]) {
                    leftRookCanCastle = false;
                    break;
                }
            }
        }
        else {
            leftRookCanCastle = false;
        }
        if (leftRookCanCastle) {
            moves.push([this.position[0] - 2, this.position[1]]);
        }

        // Right rook
        let rightRookPosition = [this.position[0] + 3, this.position[1]];
        let rightRook = this.pieceManager.squares[rightRookPosition[0]][rightRookPosition[1]].piece;

        let rightRookCanCastle = true;

        if (rightRook && !(rightRook.has_moved)) {
            for (let j = 1; j < 3; j++) {
                let square = this.pieceManager.squares[this.position[0] + j][this.position[1]];
                // If piece in the way or moving through check, cannot castle
                if (square.piece || square.control[enemyColour]) {
                    rightRookCanCastle = false;
                    break;
                }
            }
        }
        else {
            rightRookCanCastle = false;
        }
        if (rightRookCanCastle) {
            moves.push([this.position[0] + 2, this.position[1]]);
        }

        return [moves, captures, defending]

    }

    moveValidation(moveArray, enemyColour) {

        let validatedMoves = [];

        moveArray.forEach(move => {
            if (this.pieceManager.squares[move[0]][move[1]].control[enemyColour]) {
                return;
            }
            else {
                validatedMoves.push(move);
            }
        })

        return validatedMoves;
    }
}

class Pawn extends Piece {

    constructor(colour, arr, gameArea, has_moved = false) {
        super(colour, arr, gameArea, has_moved);
        this._moves = pawnMoves;
        this.can_promote = true;
    }

    get range() {
        return 2 - this.has_moved;
    }

    get moves() {
        return this._moves[this.colour];
    }

    moveLoop() {

        let [moves, ...rest] = super.moveLoop();
        let captures = [];
        let defending = [];

        let leftCapture = [this.position[0] - 1, this.position[1] + this.moves[0][1]];
        let rightCapture =[this.position[0] + 1, this.position[1] + this.moves[0][1]];

        let captureMoves = [leftCapture, rightCapture];
        captureMoves.forEach(move => {
            if(Math.max(...move) <= 7 && Math.min(...move) >= 0) {
                let piece = this.pieceManager.squares[move[0]][move[1]].piece;
                if ((piece && piece.colour != this.colour) || move.equals(enpassantCapture)) {
                    captures.push(move);
                    // If attacking King, need to add to attacking king Array set
                    if (piece && piece.rank == "King") {
                        let enemyColour = "White";
                        if (this.colour == "White") {
                            enemyColour = "Black";
                        }
                        attackingKing[enemyColour].add(this);
                        console.log(`Adding ${this.str()} to attackingKing`);
                    }
                }
                else {
                    defending.push(move);
                }
            }
        })


        // Check En Passant

        return [moves, captures, defending];
    }

    promote(row, col) {
        if (col == 0 || col == 7) {
            this.pieceManager.createPromotionWindow(row, col);
        }
    }
}

var myGameArea = {
    canvas : document.createElement("canvas"),
    start : function() {
        this.canvas.width = canvasDimension;
        this.canvas.height = canvasDimension;
        this.context = this.canvas.getContext("2d");
        document.body.insertBefore(this.canvas, document.body.childNodes[0]); // Make canvas the first child on page
        this.frameNo = 0;
        // this.interval = setInterval(updateGameArea, 20);
        },
    clear : function() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },
    drawBoard : function() {
        this.squareWidth = this.canvas.width / 8;
        this.squareHeight = this.canvas.height / 8;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                let colour = "white";
                if ((i + j) % 2 != 0) {
                    colour = "grey";
                }
                this.context.fillStyle = colour;
                this.context.fillRect(i * this.squareWidth, j * this.squareHeight, this.squareWidth, this.squareHeight);
                if (colour == "white") {
                    colour = "grey";
                }
                else {
                    colour = "white";
                }
                this.context.font = "12px Georgia";
                this.context.fillStyle = colour;
                this.context.fillText(`${i},${7 - j}`, i * this.squareWidth, j * this.squareHeight + this.squareHeight / 2 + 20);
            }
        }
    }
}

function deselectPiece() {
    return;
}

function postMove() {
    return;
}

function selectPiece(row, col) {
    let piece = board.getSquare(row, col).piece;
    let control = board.getSquare(row, col).control;
    if (!piece) {
        console.log(`Empty square, controlled by White: ${control["White"]}, controlled by Black: ${control["Black"]}`);
        return;
    }
    else if (piece.colour != playerColour) {
        console.log("You cannot select your opponents pieces!");
        return;
    }
    else if(piece.colour != turn) {
        console.log(`Cannot select ${piece.colour} piece on ${turn}'s turn`);
        return;
    }
    console.log(piece.str());
    selectedPiece = piece;
    piece.select();
    return;
}

function sendMove(selectedPiece, row, col, promotionRank) {
    console.log("Sending move");
    socket.emit('move', JSON.stringify({'piece' : [selectedPiece.row, selectedPiece.col],
        'move' : [row, col], 'turn' : turnGenSend.next().value, 'promotionRank' : promotionRank, 'room' : room}));
}

function receivedMove(data) {
    let oldRow = data['piece'][0];
    let oldCol = data['piece'][1];
    let row = data['move'][0];
    let col = data['move'][1];
    let promotionRank = data['promotionRank'];
    let piece = board.squares[oldRow][oldCol].piece;
    console.log(`Received move from server, moving ${piece.str()} to ${row}, ${col}`)
    pieceManager.movePiece(piece, row, col, promotionRank);
    deselectionProcess();
    attackingKing["White"].clear();
    attackingKing["Black"].clear();
    board.evaluateSquareControl(turn);
    turn = data['turn'];
    piece.checkDefenses();
}

function deselectionProcess() {
    drawnMoves.clear();
    deselectPiece();
    myGameArea.drawBoard();
    pieceManager.drawPieces();
    selectedPiece = null;
}

function postMoveProcess() {
    attackingKing["White"].clear();
    attackingKing["Black"].clear();
    board.evaluateSquareControl(turn);
    turn = turnGenLocal.next().value;
}


function togglePieceSelect(event) {

    let {layerX : row, layerY : col} = event;
    row = Math.floor(row / pieceImgDimension);
    col = Math.floor((canvasDimension - col) / pieceImgDimension);
    console.log(`Click on row:${row}, col:${col}`);

    // If there is a promotion window active, clicks are first checked against this window
    if (promotionWindowActive) {
        if (promotionWindowArea.has([row, col])) { // If click detected in promotion window area
            let promotionRanks = ["Queen", "Knight", "Rook", "Bishop", "Bishop", "Rook", "Knight", "Queen"];
            let promotionRank = promotionRanks[col];
            promotionWindowArea.clear();
            sendMove(selectedPiece, moveInProcess[0], moveInProcess[1], promotionRank);
            pieceManager.movePiece(selectedPiece, moveInProcess[0], moveInProcess[1], promotionRank);
            postMoveProcess();
            selectedPiece.checkDefenses();
            deselectionProcess();
            promotionWindowActive = false;
            return;
        }
        else {
            return;
        }
    }
    
    /* If a piece is already selected check if any moves have been clicked on
       if not then we must deselect the piece, redraw the board and pieces
       to cover the moves we have drawn and then set the selected piece to null*/
    if (selectedPiece) {
        let ctx = myGameArea.canvas.getContext("2d");
        console.log(`${row}, ${col} in drawnMoves: ${drawnMoves.has([row, col])}`);
        if (drawnMoves.has([row, col])) {
                moveInProcess = [row, col]
                selectedPiece.promote(row, col);
                // Check if a promotion window is now active
                if (promotionWindowActive) {
                    return;
                }
            sendMove(selectedPiece, row, col, null);
            pieceManager.movePiece(selectedPiece, row, col, null);
            postMoveProcess();
            selectedPiece.checkDefenses();
        }

        deselectionProcess();
    }
    else {
        selectPiece(row, col);
    }
}

function setupPieces() {
    for (const [i, colour] of ["White", "Black"].entries()) {
        for (const j of Array(8).keys()) {
            let pawn = new Pawn(colour, [j, 1 + (i * 5)], myGameArea);
            pawn.draw();
        }
    }
}

function startGame() {
    // myGamePiece = new component(30, 30, "red", 10, 120);
    // myGamePiece.gravity = 0.05;
    // myScore = new component("30px", "Consolas", "black", 280, 40, "text");
    myGameArea.start();
    myGameArea.drawBoard();
    myGameArea.canvas.addEventListener('click', function(Event) {canvasClick(Event)}, false);
    pieceManager = new PieceManager(myGameArea);
    board = new ChessBoard(pieceManager);
    pieceManager.setSquares(board.squares);
    board.setupPieces();
    pieceManager.drawPieces();
}

function canvasClick(event) {
    togglePieceSelect(event);
}

let ChessSquare = class {
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this._piece = null;
        this.control = {
            "White" : false,
            "Black" : false
        };
    }

    set piece(newPiece) {
        if (!(newPiece instanceof Piece) && newPiece !== null) {
            throw `${newPiece} is not a Piece!`;
        }
        this._piece = newPiece;
    }

    get piece() {
        return this._piece;
    }

    remove() {
        this._piece = null;
    }
}

class PieceManager {
    constructor(gameArea) {
        this.gameArea = gameArea;
        this.pieces = {
            "Black" : [],
            "White" : []
        }
        this.king = {
            "Black" : null,
            "White" : null
        }
    }

    setSquares(squares) {
        this.squares = squares;
    }

    createPiece(pieceClass, colour, position, gameArea) {
        let piece = new pieceClass(colour, position, gameArea);
        piece.setPieceManager(this);
        this.pieces[colour].push(piece);
        if (piece.rank == "King") {
            this.king[colour] = piece;
        }
        return piece;
    }

    drawPieces() {
        Array(...this.pieces["Black"], ...this.pieces["White"]).forEach(piece => piece.draw());
    }

    capturePiece(piece) {
        let colour = piece.colour;
        let index = this.pieces[colour].indexOf(piece);

        console.log(`Removing ${piece.str()}`);
        this.pieces[colour].splice(index, 1);
    }

    createPromotionWindow(row, col) {
        promotionWindowActive = true;

        let squareWidth = myGameArea.canvas.width / 8;
        let squareHeight = myGameArea.canvas.height / 8;
        let squareColour = "blue";

        let drawRow = row;
        let drawCol = col;
        let pieceColour = "White";
        let drawOrder = ["Queen", "Knight", "Rook", "Bishop"]

        if (col == 0) {
            drawCol += 3;
            pieceColour = "Black";
            drawOrder.reverse();
        }

        myGameArea.context.fillStyle = squareColour;
        for (const [i, rank] of drawOrder.entries()) {
            myGameArea.context.fillRect(drawRow * squareWidth, (7 - drawCol + i) * squareHeight, squareWidth, squareHeight);
            myGameArea.canvas.getContext("2d").drawImage(
                pieceImage, sx[rank], sy[pieceColour], pieceImgDimension, pieceImgDimension, drawRow * pieceImgDimension, (7 - drawCol + i) * pieceImgDimension,
                pieceImgDimension, pieceImgDimension);
            promotionWindowArea.add([drawRow, drawCol - i]);
        }

    }

    movePiece(piece, row, col, promotionRank = null) {
        let oldRow = piece.row;
        let oldCol = piece.col;
        // Check for capture
        if (this.squares[row][col].piece) {
            this.capturePiece(this.squares[row][col].piece);
        }
        // Check for enPassant capture
        if (piece.colour == "White" && piece.rank == "Pawn" && [row, col].equals(enpassantCapture)){
            this.capturePiece(this.squares[row][col - 1].piece);
        }
        else if (piece.colour == "Black" && piece.rank == "Pawn" && [row, col].equals(enpassantCapture)){
            this.capturePiece(this.squares[row][col + 1].piece);
        }

        enpassantCapture = null;

        this.squares[row][col].piece = piece;
        this.squares[oldRow][oldCol].piece = null;
        piece.position = [row, col];
        piece.has_moved = true;

        // Handle promotions
        if (promotionRank) {
             let rankLookup = {
                "Queen" : Queen,
                "Knight" : Knight,
                "Rook" : Rook,
                "Bishop" : Bishop
             };
             let promotedPiece = this.createPiece(rankLookup[promotionRank], piece.colour, [row, col], myGameArea);
             promotedPiece.has_moved = true;
             this.squares[row][col].piece = promotedPiece;

             // Remove old piece (not in capture as doesnt count for tracking purposes)
             let index = this.pieces[piece.colour].indexOf(piece);
             this.pieces[piece.colour].splice(index, 1);
             return;
        }

        // Check for castling here
        if (piece.rank == "King" && Math.abs(row - oldRow) == 2) {
            if(row - oldRow == 2) {
                let rightRook = this.squares[7][col].piece;
                this.movePiece(rightRook, 5, col);
            }
            else {
                let leftRook = this.squares[0][col].piece;
                this.movePiece(leftRook, 3, col);
            }
        }

        // Check for en passant here
        if (piece.rank == "Pawn" && Math.abs(col - oldCol) == 2) {
            // Check is piece to the right is a pawn
            if (row + 1 <= 7 && this.squares[row + 1][col].piece && this.squares[row + 1][col].piece.rank == "Pawn") {
                enpassantStack.push(this.squares[row + 1][col].piece);
            }
            // Check if piece to the right is a pawn
            if (row - 1 >= 0 && this.squares[row - 1][col].piece && this.squares[row - 1][col].piece.rank == "Pawn") {
                enpassantStack.push(this.squares[row - 1][col].piece);
            }

            if (piece.colour == "White") {
                enpassantCapture = [row, col - 1];
            }
            else {
                enpassantCapture = [row, col + 1];
            }
        }
    }

    checkmateCalculator(colour) {
        let validMoves = [];
        this.pieces[colour].forEach(piece => {
            let [moves, captures, defending] = piece.calculateMoves();
            validMoves = validMoves.concat(moves, captures);
        })

        console.log(`Number of valid moves for ${colour}: ${validMoves.length}`);

        if (validMoves.length == 0) { 
            if (this.king[colour].inCheck()) {
                console.log(`${colour} has been checkmated!`);
            }
            else {
                console.log("Stalemate");
            }
        }
    }
}

class ChessBoard {
    constructor(pieceManager) {
        this.pieceManager = pieceManager;
        this.gameArea = pieceManager.gameArea;
        this.squares = [];
        for (const j of Array(8).keys()) {
            this.squares.push(Array.from({length: 8}, (_, i) => 0));
        }
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                this.squares[row][col] = new ChessSquare(row, col);
            }
        }
    }

    setupPieces() {
        for (const [col, colour] of ["White", "Black"].entries()) {
            for (const row of Array(8).keys()) {
                let pawn = this.pieceManager.createPiece(Pawn, colour, [row, 1 + (col * 5)], this.gameArea);
                this.squares[row][1 + (col * 5)].piece = pawn;
            }

            for (const [row, rank] of [Rook, Knight, Bishop].entries()) {
                let piece;

                piece = this.pieceManager.createPiece(rank, colour, [row, col * 7], this.gameArea);
                this.squares[row][col * 7].piece = piece;

                piece = this.pieceManager.createPiece(rank, colour, [7 - row, col * 7], this.gameArea);
                this.squares[7 - row][col * 7].piece = piece;
            }

            let queen = this.pieceManager.createPiece(Queen, colour, [3, col * 7], this.gameArea);
            this.squares[3][col * 7].piece = queen;

            let king = this.pieceManager.createPiece(King, colour, [4, col * 7], this.gameArea);
            this.squares[4][col * 7].piece = king;
        }
    }

    getSquare(row, col) {
        return this.squares[row][col];
    }

    evaluateSquareControl(colour) {
        // Mark the squares controlled by the given colour

        // Reset square control for colour
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                this.squares[row][col].control[colour] = false;
            }
        }

        this.pieceManager.pieces[colour].forEach(piece => {
            for (let i = 0; i < 8; i++) {
                let moveArray;
                if(piece.rank == "King") {
                    moveArray = [];
                    piece.moves.forEach(move =>  {
                        let position = [piece.position[0] + move[0], piece.position[1] + move[1]];
                        if (Math.max(...position) <= 7 && Math.min(...position) >= 0) {
                            moveArray.push(position);
                        }

                    })
                }
                else {
                    let [moves, captures, defending] = piece.calculateMoves();
                    moveArray = [];
                    if (piece.rank != "Pawn") {
                        moveArray = moveArray.concat(moves);
                    }
                    moveArray = moveArray.concat(captures);
                    moveArray = moveArray.concat(defending);                    
                }
                moveArray.forEach(square => {
                    this.squares[square[0]][square[1]].control[colour] = true;
                })
            }
        })
    }

}

// function component(width, height, color, x, y, type) {
//     this.type = type;
//     this.score = 0;
//     this.width = width;
//     this.height = height;
//     this.speedX = 0;
//     this.speedY = 0;    
//     this.x = x;
//     this.y = y;
//     this.gravity = 0;
//     this.gravitySpeed = 0;
//     this.update = function() {
//         ctx = myGameArea.context;
//         if (this.type == "text") {
//             ctx.font = this.width + " " + this.height;
//             ctx.fillStyle = color;
//             ctx.fillText(this.text, this.x, this.y);
//         } else {
//             ctx.fillStyle = color;
//             ctx.fillRect(this.x, this.y, this.width, this.height);
//         }
//     }
//     this.newPos = function() {
//         this.gravitySpeed += this.gravity;
//         this.x += this.speedX;
//         this.y += this.speedY + this.gravitySpeed;
//         this.hitBottom();
//     }
//     this.hitBottom = function() {
//         var rockbottom = myGameArea.canvas.height - this.height;
//         if (this.y > rockbottom) {
//             this.y = rockbottom;
//             this.gravitySpeed = 0;
//         }
//     }
//     this.crashWith = function(otherobj) {
//         var myleft = this.x;
//         var myright = this.x + (this.width);
//         var mytop = this.y;
//         var mybottom = this.y + (this.height);
//         var otherleft = otherobj.x;
//         var otherright = otherobj.x + (otherobj.width);
//         var othertop = otherobj.y;
//         var otherbottom = otherobj.y + (otherobj.height);
//         var crash = true;
//         if ((mybottom < othertop) || (mytop > otherbottom) || (myright < otherleft) || (myleft > otherright)) {
//             crash = false;
//         }
//         return crash;
//     }
// }

// function updateGameArea() {
//     var x, height, gap, minHeight, maxHeight, minGap, maxGap;
//     for (i = 0; i < myObstacles.length; i += 1) {
//         if (myGamePiece.crashWith(myObstacles[i])) {
//             return;
//         } 
//     }
//     myGameArea.clear();
//     myGameArea.frameNo += 1;
//     if (myGameArea.frameNo == 1 || everyinterval(150)) {
//         x = myGameArea.canvas.width;
//         minHeight = 20;
//         maxHeight = 200;
//         height = Math.floor(Math.random()*(maxHeight-minHeight+1)+minHeight);
//         minGap = 50;
//         maxGap = 200;
//         gap = Math.floor(Math.random()*(maxGap-minGap+1)+minGap);
//         myObstacles.push(new component(10, height, "green", x, 0));
//         myObstacles.push(new component(10, x - height - gap, "green", x, height + gap));
//     }
//     for (i = 0; i < myObstacles.length; i += 1) {
//         myObstacles[i].x += -1;
//         myObstacles[i].update();
//     }
//     myScore.text="SCORE: " + myGameArea.frameNo;
//     myScore.update();
//     myGamePiece.newPos();
//     myGamePiece.update();
// }

// function everyinterval(n) {
//     if ((myGameArea.frameNo / n) % 1 == 0) {return true;}
//     return false;
// }

// function accelerate(n) {
//     myGamePiece.gravity = n;
// }

function sendJSON2(){
              
    let move = document.querySelector('#move');
      
    // Creating a XHR object
    let xhr = new XMLHttpRequest();
    let url = "/play/move_handler";

    // open a connection
    xhr.open("POST", url, true);

    // Set the request header i.e. which type of content you are sending
    xhr.setRequestHeader("Content-Type", "application/json");

    // Create a state change callback
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {

            // Print received data from server
            result.innerHTML = this.responseText;

        }
    };

    // Converting JSON data to string
    var data = JSON.stringify({ "move": move.value });

    // Sending data with the request
    xhr.send(data);
}

function sendJSON(){
    let move = document.querySelector('#move');
    socket.emit('move', {'move' : move.value, 'room' : room});
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

    setInterval(getMatchFromQueue, 1000);

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
    .then(document.getElementById("queue-btn").innerHTML = "Join Queue")
    .then(queued = false);

    clearInterval(getMatchFromQueue);
}

function toggleQueue(){
    if (queued == false){
        addClientToQueue();
        return;
    }
    removeClientFromQueue();
}