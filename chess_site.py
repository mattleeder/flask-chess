from app import create_app, db, socketio
from app.models import User
from flask_migrate import Migrate

app = create_app()
migrate = Migrate(app, db)

@app.shell_context_processor
def make_shell_context():
    return dict(User = User, db = db)

if __name__ == '__main__':
    socketio.run(app, debug = True)