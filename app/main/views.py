from . import main
from .. import socketio
from ..models import db_instance, LiveMatch, Queue, User
from flask import Blueprint, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from flask_socketio import emit, join_room, leave_room, send
import json as JSON
import random
from string import ascii_letters, digits
import sys

def generate_match_id():
    chars = ascii_letters + digits
    # TODO: Check if id already exists
    return "".join(random.choices(chars, k = 16))


@main.route('/')
def home():
    return render_template('main/home.html')

@main.route('/play/match/<game_id>', methods=['GET', 'POST'])
def match(game_id):
    """
    Serves match page to user. If user is not in match they can view as spectator.
    """
    live_match = db_instance.get_live_match(game_id)
    if live_match:
        if str(current_user.id) == live_match.white:
            db_instance.remove_player_from_queue(current_user.id)
            return render_template('main/match.html', game_id = game_id, colour = "White")
        elif str(current_user.id) == live_match.black:
            db_instance.remove_player_from_queue(current_user.id)
            return render_template('main/match.html', game_id = game_id, colour = "Black")
    return render_template('main/match.html', game_id=game_id, colour = "Spectator")

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

@main.route('/play/get_all_moves/<match_id>', methods = ['GET'])
def get_all_moves(match_id):
    moves = db_instance.get_all_moves(match_id)
    return JSON.dumps({'moves' : moves})

@main.route('/search')
def search():
    query = request.args.get('query')
    user = db_instance.get_user_from_username(username = query) 
    if user:
        return redirect(url_for('account.profile', username = user.username))
    return render_template('main/search.html')

@main.route('/play/queue_handler', methods=['GET', 'POST'])
def queue_handler():
    data = JSON.loads(request.get_json())
    user_id = current_user.id
    command = data["queue"]
    if command == "add":
        db_instance.add_player_to_queue(user_id)
    if command == "remove":
        db_instance.remove_player_from_queue(user_id)
    return data

def pair_players_in_queue():
    pass

@main.route('/play/request_match_from_queue', methods=['GET', 'POST'])
@login_required
def match_from_queue():

    # Check if already assigned match
    match = db_instance.get_user_queue_state(user_id = current_user.id) 
    match_id = None
    if match:
        match_id = match.game_id

    elif Queue.query.count() <= 1:
        return {
            "match_found" : False,
        }
    
    if not match_id:
        match_id = generate_match_id()
        colour_index = random.randint(0, 1) # 0 is White 1 is Black

        # Get an opponent
        opp = db_instance.find_opponent(current_user.id)

        if not opp:
            return {
            "match_found" : False,
            }

        white = [current_user.id, opp][colour_index]
        black = [current_user.id, opp][(colour_index + 1) % 2]

        db_instance.create_new_live_match(match_id, white, black)

    return {
        "match_found" : True,
        "match_url" : url_for('main.match', game_id=match_id)
    }

@socketio.on('my_event')
def handle_my_custom_event(json):
    print('server: received json: ' + str(json), file = sys.stderr)
    emit('server_response', {'move' : 'server: received json: ' + str(json)})

@socketio.on('join')
@login_required
def socket_join(data):
    username = current_user.username
    room = data["match_id"]
    join_room(room)
    send(username + " has joined the match", to = room)
    fen = db_instance.get_match_fen(room)
    print(f"Sending fen: {fen}", file = sys.stderr)
    emit("server_response", {"fen" : fen}, to = request.sid)

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
    print(current_user.id, file = sys.stderr)
    print(json, file = sys.stderr)
    json = JSON.loads(json)
    room = json["room"]
    fen = json["fen"]
    move = str(json["move"])
    print(f"Move: {move}", file = sys.stderr)
    print(f"FEN: {fen}", file = sys.stderr)
    db_instance.update_match(fen, room)
    db_instance.add_move(move, fen, room)
    print(fen, file = sys.stderr)
    emit('server_response', {'fen' : json['fen'], 'move' : json['move']}, to=room, broadcast = True, include_self = False)
