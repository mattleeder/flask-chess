from . import db
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from . import login_manager

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

    id = db.Column(db.Integer, primary_key = True)
    game_id = db.Column(db.String(16), nullable = True)
    colour = db.Column(db.Integer)

class LiveMatch(db.Model):
    __tablename__ = "live_matches"

    id = db.Column(db.Integer, primary_key = True)
    game_id = db.Column(db.String(16), nullable = True)
    colour = db.Column(db.Integer)

@login_manager.user_loader
def load_user(user_id):
    return User.query.filter_by(id=user_id).first()

# class Match(db.Model):
#     __tablename__ = "matches"

#     id = db.Column(db.String(16), unique = True, primary_key = True)
#     white = db.Column(db.String(32), db.ForeignKey('users.id'), index = True,  nullable = False) # Player
#     black = db.Column(db.String(32), db.ForeignKey('users.id'), index = True, nullable = False) # Player

#     moves = db.relationship('moves', backref='match')

# class Move(db.Model):
#     __tablename__ = "moves"

#     id = db.Column(db.Integer, primary_key = True)
#     move = db.Column(db.String(), nullable = False)
#     colour_id = db.Column(db.Integer, db.ForeignKey('colours.id'), nullable = False) # White is 1, Black is 2
#     match_id = db.Column(db.String(16), db.ForeignKey('matches.id'), nullable = False)

# class Colour(db.Model):
#     __tablename__ = "colours"

#     id = db.Column(db.Integer, primary_key = True)
#     colour = db.Column(db.String(5))

#     moves = db.relationship('moves', backref = 'colour')

# Need to run flask db migrate
# class MatchLookup(db.Model):
#     __tablename__ = 'matches_lookup'
#     player_id = 
#     match_id