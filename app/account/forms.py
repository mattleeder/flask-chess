from ast import Pass
from flask import Flask
from flask_wtf import FlaskForm
from wtforms import StringField, SubmitField, ValidationError, PasswordField
from wtforms.validators import DataRequired, Length, EqualTo, Email,Optional
from ..utils import RedirectForm
from ..models import User
from flask_login import current_user

class UserSignupForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(1, 32)])
    email = StringField('Email (Optional)', validators=[Optional(), Length(0,32), Email()])
    password = PasswordField('Password', validators=[DataRequired(), EqualTo('password2', message = 'Passwords must match')])
    password2 = PasswordField('Type Password Again', validators=[DataRequired()])
    submit = SubmitField('Sign Up')

    def validate_username(self, field):
        if User.query.filter_by(username = field.data).first():
            raise ValidationError('Username already exists')

    def validate_email(self, field):
        if User.query.filter_by(email = field.data).first():
            raise ValidationError('Email already exists')

class ChangePasswordForm(FlaskForm):
    old_password = PasswordField('Old Password', validators=[DataRequired()])
    password = PasswordField('New Password', validators=[DataRequired(), EqualTo('password2', message = 'Passwords must match')])
    password2 = PasswordField('Type New Password Again', validators=[DataRequired()])
    submit = SubmitField('Change Password')

    def validate_old_password(self, field):
        if not current_user.verify_password(field.data):
            raise ValidationError('Old Password Incorrect')

class ChangeEmailForm(FlaskForm):
    email = StringField('Email', validators=[Length(0,32), Email(), EqualTo('email2', message = 'Emails must match')])
    email2 = StringField('Type Email Again', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Change Email')

    def validate_password(self, field):
        if not current_user.verify_password(field.data):
            raise ValidationError('Password Incorrect')

class ResetPasswordForm(FlaskForm):
    pass

class CurrentUserDataForm(FlaskForm):
    username = StringField('Username')
    email = StringField('Email')

    
class UserLoginForm(RedirectForm):
    username = StringField('Username')
    password = PasswordField('Password')
    submit = SubmitField('Login')