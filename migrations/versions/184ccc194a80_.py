"""empty message

Revision ID: 184ccc194a80
Revises: 06fec8356c03
Create Date: 2022-06-26 14:34:20.162670

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '184ccc194a80'
down_revision = '06fec8356c03'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('queue', sa.Column('colour', sa.Integer(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('queue', 'colour')
    # ### end Alembic commands ###
