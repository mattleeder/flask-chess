from . import db, login_manager
from alembic import op
import enum
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class Colour(enum.Enum):
    white = "White"
    black = "Black"

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key = True)
    username = db.Column(db.String(32), unique = True, index = True)
    password_hash = db.Column(db.String(128))
    email = db.Column(db.String(32), nullable = True)

    @property
    def password(self):
        raise AttributeError('Not readable attribute')

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password, salt_length=8)

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)
        
    def __repr__(self):
        return f'User({self.id}, {self.username})'

    def __str__(self):
        return f'User: {self.username}'

class Queue(db.Model):
    __tablename__ = "queue"

    id = db.Column(db.Integer, primary_key = True) # Player
    game_id = db.Column(db.String(16), nullable = True)

class LiveMatch(db.Model):
    __tablename__ = "live_matches"

    game_id = db.Column(db.String(16), unique = True, primary_key = True) # Match id
    white = db.Column(db.String(32), db.ForeignKey('users.id'), index = True, nullable = False) # Player
    black = db.Column(db.String(32), db.ForeignKey('users.id'), index = True, nullable = False) # Player
    fen = db.Column(db.String(128), default = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

@login_manager.user_loader
def load_user(user_id: str):
    user = User.query.filter_by(id = user_id).first()
    return user if user else None

class Match(db.Model):
    __tablename__ = "matches"

    game_id = db.Column(db.String(16), unique = True, primary_key = True)
    white = db.Column(db.String(32), db.ForeignKey('users.id'), index = True,  nullable = False) # Player
    black = db.Column(db.String(32), db.ForeignKey('users.id'), index = True, nullable = False) # Player
    # Final state of game
    fen = db.Column(db.String(128))

#     moves = db.relationship('moves', backref='match')

class Move(db.Model):
    __tablename__ = "moves"

    id = db.Column(db.Integer, primary_key = True)
    move = db.Column(db.String(8), nullable = False)
    fen = db.Column(db.String(128), nullable = False)
    colour = db.column(db.Enum(Colour))
    # Match this move belongs
    match_id = db.Column(db.String(16), db.ForeignKey('matches.game_id'), nullable = False, index = True)
    # Move number, white makes move 1, black makes move 2 etc.
    move_number = db.Column(db.Integer, default = 1)


class DBWrapper:

    def __init__(self, db):
        self.db = db

    def add_player_to_queue(self, user_id):
        """
        Puts a player into the match queue
        """
        queue = Queue(id = user_id)
        self.db.session.add(queue)
        self.db.session.commit()

    def remove_player_from_queue(self, user_id):
        """
        Removes a player from the match queue
        """
        Queue.query.filter_by(id = user_id).delete()
        db.session.commit()

    def find_opponent(self, user_id):
        """
        Finds an opponent for the given user
        """
        opponent = Queue.query.filter(Queue.id != user_id, Queue.game_id == None).first()
        if opponent:
            return opponent.id
        return None

    def get_user_queue_state(self, user_id):
        """
        Returns the queue object for a given user_id
        """
        return Queue.query.filter_by(id = user_id).first()

    def create_new_live_match(self, match_id, white, black):
        """
        Creates a new match
        """
        live_match = LiveMatch(game_id = match_id, white = white, black = black)
        white_queue = Queue.query.filter_by(id = white).first()
        white_queue.game_id = match_id
        black_queue = Queue.query.filter_by(id = black).first()
        black_queue.game_id = match_id
        self.db.session.add(live_match)
        self.db.session.add(white_queue)
        self.db.session.add(black_queue)
        self.db.session.commit()

    def get_match_fen(self, game_id):
        """
        Gets the current FEN for the given game_id.
        If game_id doesn't exist return FEN for starting position
        """
        match = LiveMatch.query.filter_by(game_id = game_id).first()
        if match:
            return match.fen
        return LiveMatch.fen.default

    def get_live_match(self, game_id):
        """
        Gets the live match for the given game_id
        """
        return LiveMatch.query.filter_by(game_id = game_id).first()

    def get_user_from_username(self, username):
        """
        Retunrs the user object for the given username
        """
        return User.query.filter_by(username = username).first()


    def mark_live_match_finished(self):
        """
        Removes a match from the LiveMatch table and adds it to the Match table
        """
        pass

    def update_match(self, fen, match_id):
        """
        Updates the FEN of the given match id
        """
        match = LiveMatch.query.filter_by(game_id = match_id).first()
        match.fen = fen
        db.session.commit()

    def add_move(self, move, fen, match_id):
        """
        Adds a move the the Move table, move number is calculated
        """
        latest_move = Move.query.filter_by(match_id = match_id).order_by(db.desc(Move.move_number)).first()
        if latest_move:
            move_number = latest_move.move_number + 1
        else:
            move_number = 1
        # All odd moves are made by White, all even by Black
        colour = Colour.black if move_number % 2 == 0 else Colour.white
        move = Move(move = move, fen = fen, colour = colour, match_id = match_id, move_number = move_number)
        db.session.add(move)
        db.session.commit()

    def get_all_moves(self, match_id):
        """
        Returns a list of tuples containing (move_number, fen) object for all moves for the given match_id
        """
        # May need to add order by
        moves = Move.query.filter_by(match_id = match_id).all()
        return [(move.move_number, move.move, move.fen) for move in moves]

db_instance = DBWrapper(db)
