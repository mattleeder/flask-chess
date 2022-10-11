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
        this.class = this.constructor.name;
        this.position = position; // [file, rank]
        this.gameArea = gameArea;
        this.has_moved = has_moved;
        // this.moveCache = [];

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
            throw new OutOfBoundsError(`${newPosition} out of Bounds, must be (0, 0) to (7, 7)`);
        }
        this._position = newPosition;
    }

    get position() {
        return this._position;
    }

    get file() {
        return this._position[0];
    }

    get rank() {
        return this._position[1]
    }

    repr() {
        return `${this.constructor.name}(${this.colour}, [${this._position}])`
    }

    str() {
        return `${this.colour} ${this.class} at ${this.position}`;
    }

    draw() {
        this.gameArea.canvas.getContext("2d").drawImage(
            pieceImage, sx[this.class], sy[this.colour], pieceImgDimension, pieceImgDimension, this.file * pieceImgDimension, ((7 - this.rank) * pieceImgDimension),
            pieceImgDimension, pieceImgDimension
        );
    }

    promote(file, rank) {
        // All pieces will call this, so if a piece cant promote then it will do nothing
        return;
    }

    calculateMoves() {

        let [validMoves, validCaptures, defending] = this.moveLoop();
        let illegalMoves;
        let legalMoves;
        let legalCaptures;
        let illegalCaptures;

        if (this.isPinned()) {
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
        let attacker = Array.from(attackingKing[this.colour])[0];

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
                    else if(attacker && attacker.class == "Pawn" && enpassantCapture && enpassantCapture.equals([attacker.position[0], attacker.position[1] + this.moves[0][1]])) {
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
                    if (piece.class != "King") {
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
            else if (["King", "Pawn", "Knight"].includes(piece.class)) {
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
                let direction = chessUnitDirectionVector(attacker.position, kingPiece.position);
                validCheckDefenses.add(attacker.position);
                let magnitude = 1;
                while (true) {
                    let newMove = addVector(attacker.position, scaleVector(direction, magnitude));
                    if (attacker.class == "Knight") { // Knight will be attacking king on magnitude = 1
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
        //let moves = this.moveCache;
        //let captures = [];
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
        if (Math.max(...leftRookPosition) > 7 || Math.min(...leftRookPosition) < 0) {

        }
        else {
            let leftRookCanCastle = true;
            if (this.pieceManager.squares[leftRookPosition[0]][leftRookPosition[1]].piece && this.pieceManager.squares[leftRookPosition[0]][leftRookPosition[1]].piece.class == "Rook") {
                let leftRook = this.pieceManager.squares[leftRookPosition[0]][leftRookPosition[1]].piece;
        
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
            }

            else {
                leftRookCanCastle = false;
            }

            if (leftRookCanCastle) {
                moves.push([this.position[0] - 2, this.position[1]]);
            }
        }
            
        

        // Right rook
        let rightRookPosition = [this.position[0] + 3, this.position[1]];
        if (Math.max(...rightRookPosition) > 7 || Math.min(...rightRookPosition) < 0) {

        }
        else {
            console.log(`Right rook position ${rightRookPosition}`);
            let rightRookCanCastle = true;
            if (this.pieceManager.squares[rightRookPosition[0]][rightRookPosition[1]].piece && this.pieceManager.squares[rightRookPosition[0]][rightRookPosition[1]].piece.class == "Rook") {
                let rightRook = this.pieceManager.squares[rightRookPosition[0]][rightRookPosition[1]].piece;
    
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
            }
    
            else {
                rightRookCanCastle = false;
            }
    
            if (rightRookCanCastle) {
                moves.push([this.position[0] + 2, this.position[1]]);
            }
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

    checkValidation(moves) {
        return [moves, []];
    }

    isPinned() {
        return false;
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
                    if (piece && piece.class == "King") {
                        let enemyColour = "White";
                        if (this.colour == "White") {
                            enemyColour = "Black";
                        }
                        attackingKing[enemyColour].add(this);
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

    promote(file, rank) {
        if (rank == 0 || rank == 7) {
            this.pieceManager.createPromotionWindow(file, rank);
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

function selectPiece(file, rank) {
    /*Check click for selectable piece, piece must be of players colour
    and it must be players turn*/
    let piece = board.getSquare(file, rank).piece;
    if (!piece) {
        console.log("Empty square")
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

function sendMove(selectedPiece, file, rank, promotionRank) {
    // Send move to websocket
    console.log("Sending move");
    console.log(`Sending FEN ${generateFEN()}`);
    socket.emit('move', JSON.stringify({'piece' : [selectedPiece.file, selectedPiece.rank],
        'move' : [file, rank], 'turn' : turnGenSend.next().value, 'promotionRank' : promotionRank, 'room' : room, 'fen' : generateFEN()}));
}

function receivedMove(data) {
    // Parses data
    let {
        // "piece" : [oldRow, oldCol],
        // "move" : [file, rank],
        // "promotionRank": promotionRank,
        // "turn" : nextTurn,
        "fen" : fen
    } = data;


    // let piece = board.squares[oldRow][oldCol].piece;
    // console.log(`Received move from server, moving ${piece.str()} to ${file}, ${rank}`)
    // pieceManager.movePiece(piece, file, rank, promotionRank);
    console.log(`Calling parseFEN with ${fen}`);
    pieceManager.clearAllPieces();
    parseFEN(fen);
    deselectionProcess();
    attackingKing["White"].clear();
    attackingKing["Black"].clear();
    let evalColour = "White"
    if (turn == "White") {
        evalColour = "Black";
    }
    board.evaluateSquareControl(evalColour);
    pieceManager.king[evalColour].checkDefenses();
    // board.evaluateSquareControl("White");
    // board.evaluateSquareControl("Black");
    // pieceManager.king["Black"].checkDefenses();
    // pieceManager.king["White"].checkDefenses();
    // console.log(`Turn changing to ${turn}`);
    // turn = nextTurn;
    // piece.checkDefenses();
}

function deselectionProcess() {
    drawnMoves.clear();
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

function makeMove(selectedPiece, file, rank, promotionRank) {
    pieceManager.movePiece(selectedPiece, file, rank, promotionRank);
    postMoveProcess();
    selectedPiece.checkDefenses();
    sendMove(selectedPiece, file, rank, promotionRank);
}

function promotionWindowClick(file, rank) {
    // If click detected in promotion window area
    console.log(`Promotion window click on ${file}, ${rank}`);
    if (promotionWindowArea.has([file, rank])) {
        console.log("Click in promotion window");
        let promotionRanks = ["Queen", "Knight", "Rook", "Bishop", "Bishop", "Rook", "Knight", "Queen"];
        let promotionRank = promotionRanks[rank];
        promotionWindowArea.clear();
        makeMove(selectedPiece, moveInProcess[0], moveInProcess[1], promotionRank);
        deselectionProcess();
        promotionWindowActive = false;
        return;
    }
    return;

}

function moveClick(file, rank) {

    moveInProcess = [file, rank]
    selectedPiece.promote(file, rank);
    // Check if a promotion window is now active
    if (promotionWindowActive) {
        return;
    }
    makeMove(selectedPiece, file, rank, null);
}

function togglePieceSelect(file, rank) {
    if (!selectedPiece) {
        selectPiece(file, rank);
        return;
    }
    /* If a piece is already selected check if any moves have been clicked on
       if not then we must deselect the piece, redraw the board and pieces
       to cover the moves we have drawn and then set the selected piece to null*/
    else if (drawnMoves.has([file, rank])) {
        moveClick(file, rank);
        if (promotionWindowActive) {
            return;
        }
    }
    deselectionProcess();
}

function canvasClick(event) {

    let {layerX : file, layerY : rank} = event;
    file = Math.floor(file / pieceImgDimension);
    rank = Math.floor((canvasDimension - rank) / pieceImgDimension);

    // If there is a promotion window active, clicks are first checked against this window
    if (promotionWindowActive) {
        promotionWindowClick(file, rank);
    }
    else {
        togglePieceSelect(file, rank);
    }
    return;
}

function startGame() {
    myGameArea.start();
    myGameArea.drawBoard();
    myGameArea.canvas.addEventListener('click', function(Event) {canvasClick(Event)}, false);
    pieceManager = new PieceManager(myGameArea);
    board = new ChessBoard(pieceManager);
    pieceManager.setSquares(board.squares);
    board.setupPieces();
    pieceManager.drawPieces();
}

let ChessSquare = class {
    constructor(file, rank) {
        this.file = file;
        this.rank = rank;
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

    createPiece(pieceClass, colour, position, gameArea, hasMoved = false) {
        let piece = new pieceClass(colour, position, gameArea, hasMoved);
        piece.setPieceManager(this);
        this.pieces[colour].push(piece);
        if (piece.class == "King") {
            this.king[colour] = piece;
        }
        this.squares[position[0]][position[1]].piece = piece;
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

    createPromotionWindow(file, rank) {
        promotionWindowActive = true;

        let squareWidth = myGameArea.canvas.width / 8;
        let squareHeight = myGameArea.canvas.height / 8;
        let squareColour = "blue";

        let drawRow = file;
        let drawCol = rank;
        let pieceColour = "White";
        let drawOrder = ["Queen", "Knight", "Rook", "Bishop"]

        if (rank == 0) {
            drawCol += 3;
            pieceColour = "Black";
            drawOrder.reverse();
        }

        myGameArea.context.fillStyle = squareColour;
        for (const [i, classType] of drawOrder.entries()) {
            myGameArea.context.fillRect(drawRow * squareWidth, (7 - drawCol + i) * squareHeight, squareWidth, squareHeight);
            myGameArea.canvas.getContext("2d").drawImage(
                pieceImage, sx[classType], sy[pieceColour], pieceImgDimension, pieceImgDimension, drawRow * pieceImgDimension, (7 - drawCol + i) * pieceImgDimension,
                pieceImgDimension, pieceImgDimension);
            promotionWindowArea.add([drawRow, drawCol - i]);
        }

    }

    clearAllPieces() {
        this.pieces["Black"] = [];
        this.pieces["White"] = [];
        this.capturePiece(this.king["Black"]);
        this.capturePiece(this.king["White"]);
        console.log(`Num Black pieces: ${this.pieces["Black"].length}`);
        console.log(`Num White pieces: ${this.pieces["White"].length}`);
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                this.squares[j][7 - i].remove();
            }
        }
    }

    movePiece(piece, file, rank, promotionRank = null) {
        let oldRow = piece.file;
        let oldCol = piece.rank;
        // Check for capture
        if (this.squares[file][rank].piece) {
            this.capturePiece(this.squares[file][rank].piece);
        }
        // Check for enPassant capture
        if (piece.colour == "White" && piece.class == "Pawn" && [file, rank].equals(enpassantCapture)){
            this.capturePiece(this.squares[file][rank - 1].piece);
        }
        else if (piece.colour == "Black" && piece.class == "Pawn" && [file, rank].equals(enpassantCapture)){
            this.capturePiece(this.squares[file][rank + 1].piece);
        }

        enpassantCapture = null;

        this.squares[file][rank].piece = piece;
        this.squares[oldRow][oldCol].piece = null;
        piece.position = [file, rank];
        piece.has_moved = true;

        // Handle promotions
        if (promotionRank) {
             let classLookup = {
                "Queen" : Queen,
                "Knight" : Knight,
                "Rook" : Rook,
                "Bishop" : Bishop
             };
             let promotedPiece = this.createPiece(classLookup[promotionRank], piece.colour, [file, rank], myGameArea);
             promotedPiece.has_moved = true;

             // Remove old piece (not in capture as doesnt count for tracking purposes)
             let index = this.pieces[piece.colour].indexOf(piece);
             this.pieces[piece.colour].splice(index, 1);
             return;
        }

        // Check for castling here
        if (piece.class == "King" && Math.abs(file - oldRow) == 2) {
            if(file - oldRow == 2) {
                let rightRook = this.squares[7][rank].piece;
                this.movePiece(rightRook, 5, rank);
            }
            else {
                let leftRook = this.squares[0][rank].piece;
                this.movePiece(leftRook, 3, rank);
            }
        }

        // Check for en passant here
        if (piece.class == "Pawn" && Math.abs(rank - oldCol) == 2) {
            // Check is piece to the right is a pawn
            if (file + 1 <= 7 && this.squares[file + 1][rank].piece && this.squares[file + 1][rank].piece.class == "Pawn") {
                enpassantStack.push(this.squares[file + 1][rank].piece);
            }
            // Check if piece to the left is a pawn
            if (file - 1 >= 0 && this.squares[file - 1][rank].piece && this.squares[file - 1][rank].piece.class == "Pawn") {
                enpassantStack.push(this.squares[file - 1][rank].piece);
            }

            if (piece.colour == "White") {
                enpassantCapture = [file, rank - 1];
            }
            else {
                enpassantCapture = [file, rank + 1];
            }
        }
    }

    checkmateCalculator(colour) {
        let validMoves = [];
        this.pieces[colour].forEach(piece => {
            let [moves, captures, ...rest] = piece.calculateMoves();
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
        for (let file = 0; file < 8; file++) {
            for (let rank = 0; rank < 8; rank++) {
                this.squares[file][rank] = new ChessSquare(file, rank);
            }
        }
    }

    setupPieces() {
        parseFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        //parseFEN("r1bqkbnr/ppppp1pp/2n5/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 1");
    }

    getSquare(file, rank) {
        return this.squares[file][rank];
    }

    evaluateSquareControl(colour) {
        // Mark the squares controlled by the given colour

        // Reset square control for colour
        for (let file = 0; file < 8; file++) {
            for (let rank = 0; rank < 8; rank++) {
                this.squares[file][rank].control[colour] = false;
            }
        }

        this.pieceManager.pieces[colour].forEach(piece => {
            for (let i = 0; i < 8; i++) {
                let moveArray;
                if(piece.class == "King") {
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
                    // piece.moveCache = [];
                    // piece.moveCache.concat(moves);
                    // piece.moveCache.concat(captures);
                    moveArray = [];
                    if (piece.class != "Pawn") {
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

function sendJSON(){
    let move = document.querySelector('#move');
    socket.emit('move', {'move' : move.value, 'room' : room});
}

function parseFEN(fen) {
    let pieces = [];
    let rankMap = {
        "p" : Pawn,
        "k" : King,
        "q" : Queen,
        "r" : Rook,
        "n" : Knight,
        "b" : Bishop
    };
    let [placement, active, castling, enpassant, halfMove, fullMove] = fen.split(" ");

    let file;
    let rank;
    let index = 0;

    for (let i = 0; i < placement.length; i++) {
        char = fen[i];
        if (char == "/") {
            //Skip
            continue
        }
        else if (Number(char)) {
            // Empty spaces
            pieces.concat(Array(Number(char)).fill(null));
            index += Number(char);
        }
        else {
            let colour = "Black";
            if (char == char.toUpperCase()) {
                colour = "White";
            }
            file = index % 8;
            rank = 7 - Math.floor(index / 8);
            let hasMoved = false;
            if (char.toLowerCase() == "p" && ((colour == "White" && rank != 1) || (colour == "Black" && rank != 6))) {
                console.log(`Pawn at ${file} ${rank} has moved`);
                hasMoved = true;
            }
            if (char.toLowerCase() == "r") {
                hasMoved = true;
            }
            let piece = pieceManager.createPiece(rankMap[char.toLowerCase()], colour, [file, rank], myGameArea, hasMoved);
            index += 1;
        }
    }
    console.log(`Active ${active}`);

    if (active == "w") {
        console.log("Making turn White");
        turn = "White";
    }
    else {
        console.log("Making turn Black");
        turn = "Black";
    }

    let castleMap = {
        "K" : [7, 0],
        "Q" : [0, 0],
        "k" : [7, 7],
        "q" : [0, 7]
    };

    for (let i = 0; i < castling.length; i++) {
        if (castling[i] == "-") {
            break;
        }
        let [r, c] = castleMap[castling[i]];
        if (pieceManager.squares[r][c].piece) {
            pieceManager.squares[r][c].piece.has_moved = false;
        }
    }

    let fileMap = {
        "a" : 0,
        "b" : 1,
        "c" : 2,
        "d" : 3,
        "e" : 4,
        "f" : 5,
        "g" : 6,
        "h" : 7
    };

    if (enpassant == "-") {
        enpassantCapture = null;
    }
    else {
        enpassantCapture = [fileMap[enpassant[0]], parseInt(enpassant[1]) - 1];
    }



}

function generateFEN() {

    let FEN = "";

    let rankMap = {
        "Pawn" : "p",
        "King" : "k",
        "Queen" : "q",
        "Rook" : "r",
        "Knight" : "n",
        "Bishop" : "b"
    };

    let turnMap = {
        "White" : "w",
        "Black" : "b"
    }

    let fileMap = {
        0 : "a",
        1 : "b",
        2 : "c",
        3 : "d",
        4 : "e",
        5 : "f",
        6 : "g",
        7 : "h"
    }

    for (let i = 0; i < 8; i++) {
        let blank = 0;
        for (let j = 0; j < 8; j++) {
            p = pieceManager.squares[j][7 - i].piece;

            if (!p) {
                blank += 1;
                continue;
            }

            else {
                if (blank > 0) {
                    FEN += blank.toString();
                    blank = 0;
                }
                let rank = rankMap[p.class];
                if (p.colour  == "White") {
                    rank = rank.toUpperCase();
                }
                FEN += rank;
            }
        }
        if (blank > 0) {
            FEN += blank.toString();
        }
        if (i < 7) {
            FEN += "/";
        }
    }

    FEN += " ";
    FEN += turnMap[turn];
    FEN += " ";

    let castling = "";

    if (!pieceManager.king["White"].has_moved) {
        if (pieceManager.squares[7][0].piece && !pieceManager.squares[7][0].piece.has_moved) {
            castling += "K";
        }
        if (pieceManager.squares[0][0].piece && !pieceManager.squares[0][0].piece.has_moved) {
            castling += "Q";
        }
    }

    if (!pieceManager.king["Black"].has_moved) {
        if (pieceManager.squares[7][7].piece && !pieceManager.squares[7][7].piece.has_moved) {
            castling += "k";
        }
        if (pieceManager.squares[0][7].piece && !pieceManager.squares[0][7].piece.has_moved) {
            castling += "q";
        }
    }

    if (castling) {
        FEN += castling;
    }
    else {
        FEN += "-";
    }

    FEN += " ";

    let enpassant;

    if (enpassantCapture !== null) {
        enpassant = fileMap[enpassantCapture[0]];
        enpassant += (enpassantCapture[1] + 1).toString();
    }
    else {
        enpassant = "-"
    }

    FEN += enpassant;
    
    

    

    return FEN;
}
