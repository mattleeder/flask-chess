from flask_login import current_user, login_required
from . import main
from flask import redirect, render_template, Blueprint, url_for, request
from ..models import LiveMatch, User, Queue
from .. import db, socketio
import json as JSON
import random
from string import ascii_letters, digits
from sqlalchemy import func
from flask_socketio import send, emit, join_room, leave_room

def generate_match_id():
    chars = ascii_letters + digits
    # Check if id already exists
    return "".join(random.choices(chars, k = 16))


@main.route('/')
def home():
    return render_template('main/home.html')

@main.route('/play/match/<game_id>', methods=['GET', 'POST'])
def match(game_id, colour="Spectator"):
    player = LiveMatch.query.filter_by(id = current_user.id).first()
    if player:
        colours = ["White", "Black"]
        colour_index = player.colour
        colour = colours[colour_index]
        print(colour)
    return render_template('main/match.html', game_id=game_id, colour = colour)

@main.route('/play', methods=['GET', 'POST'])
@login_required
def play():
    return render_template('main/play.html', game_id = None, user = current_user)

@main.route('/play/move_handler', methods=['GET', 'POST'])
def move_handler():
    if request.method == 'POST':
        move = JSON.loads(request.get_json())['move']
        return JSON.dumps({'move' : move, 'valid' : True})
    elif request.method == 'GET':
        return {
            'move' : 'got'
        }

@main.route('/search')
def search():
    query = request.args.get('query')
    user = User.query.filter_by(username = query).first()
    if user:
        return redirect(url_for('account.profile', username = user.username))
    return render_template('main/search.html')

@main.route('/play/queue_handler', methods=['GET', 'POST'])
def queue_handler():
    data = JSON.loads(request.get_json())
    user_id = current_user.id
    command = data["queue"]
    if command == "add":
        queue = Queue(id=user_id)
        db.session.add(queue)
        db.session.commit()
    if command == "remove":
        queue = Queue.query.filter_by(id=user_id).delete()
        db.session.commit()
    return data

def pair_players_in_queue():
    pass

@main.route('/play/request_match_from_queue', methods=['GET', 'POST'])
@login_required
def match_from_queue():
    pair_players_in_queue()

    colours = ["White", "Black"]
    # Check if already assigned match
    match = Queue.query.filter_by(id=current_user.id).first()
    match_id = None
    if match:
        match_id = match.game_id
        colour_index = match.colour

    elif Queue.query.count() <= 1:
        return {
            "match_found" : False,
        }
    
    if not match_id:
        match_id = generate_match_id()
        colour_index = random.randint(0, 1) # 0 is White 1 is Black
        opp_index = [1, 0]

        # Get an opponent
        opp = Queue.query.filter(Queue.id != current_user.id, Queue.game_id == None).first()

        if not opp:
            return {
            "match_found" : False,
        }
        opp.game_id = match_id
        opp.colour = opp_index[colour_index]
        match.game_id = match_id
        match.colour = colour_index

        db.session.add(match)
        db.session.add(opp)
        db.session.commit()

        player1 = LiveMatch(id=match.id, game_id=match.game_id, colour=match.colour)
        player2 = LiveMatch(id=opp.id, game_id=opp.game_id, colour=opp.colour)

        db.session.add(player1)
        db.session.add(player2)
        db.session.commit()

    print(match_id)
    print(url_for('main.match', game_id=match_id))
    return {
        "match_found" : True,
        "match_url" : url_for('main.match', game_id=match_id)
    }

@socketio.on('my_event')
def handle_my_custom_event(json):
    print('server: received json: ' + str(json))
    emit('server_response', {'move' : 'server: received json: ' + str(json)})

@socketio.on('join')
@login_required
def socket_join(data):
    username = current_user.username
    room = data["match_id"]
    join_room(room)
    send(username + " has joined the match", to = room)
    match = LiveMatch.query.filter_by(game_id = room).first()
    print(f"Sending fen: {match.fen}")
    emit("server_response", {"fen" : match.fen}, to = request.sid)

@socketio.on('leave')
@login_required
def socket_leave(data):
    username = current_user.username
    room = data["room"]
    leave_room(room)
    send(username +" has left the match", to = room)

@socketio.on('move')
@login_required
def socket_move(json):
    print(current_user.id)
    print(json)
    json = JSON.loads(json)
    room = json["room"]
    fen = json["fen"]
    matches = LiveMatch.query.filter_by(game_id = room).all()
    for match in matches:
        match.fen = fen
    db.session.commit()
    print(fen)
    emit('server_response', {'fen' : json['fen']}, to=room, broadcast = True, include_self = False)
    # emit('server_response', {'move' : json["move"], 'piece' : json["piece"], 'promotionRank' : json['promotionRank'], 'turn' : json['turn'], 'fen' : json['fen']}, to=room, broadcast = True, include_self = False)
    

def setup_match():
    pass