"""empty message

Revision ID: d973781901f1
Revises: 184ccc194a80
Create Date: 2022-06-26 14:54:07.610468

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd973781901f1'
down_revision = '184ccc194a80'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('live_matches',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('game_id', sa.String(length=16), nullable=True),
    sa.Column('colour', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('live_matches')
    # ### end Alembic commands ###
