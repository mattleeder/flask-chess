import os
from flask_socketio import SocketIO
from flask import Flask
from flask_bootstrap import Bootstrap5
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
# import gevent
# import geventwebsocket

basedir = os.path.abspath(os.path.dirname(__file__))

bootstrap = Bootstrap5()
db = SQLAlchemy()
login_manager = LoginManager()
socketio = SocketIO(logger=True)

login_manager.login_view = 'account.login'

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'data.sqlite')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'thisstringisnotpossibletoguess'

    bootstrap.init_app(app)
    db.init_app(app)
    login_manager.init_app(app)
    socketio.init_app(app)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .account import account as account_blueprint
    app.register_blueprint(account_blueprint)
    
    return app
