from . import account
from flask import flash, redirect, url_for, render_template
from .forms import CurrentUserDataForm, UserSignupForm, UserLoginForm, ChangePasswordForm, ChangeEmailForm
from flask_login import login_required, login_user, current_user, logout_user
from ..models import User
from .. import db

@account.route('/register', methods=['GET', 'POST'])
def register():
    form = UserSignupForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data, password=form.password.data)
        db.session.add(user)
        db.session.commit()
        return redirect(url_for('account.register'))
    return render_template('account/register.html', form=form)

@account.route('/login', methods=['GET', 'POST'])
def login():
    form = UserLoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user is not None and user.verify_password(form.password.data):
            flash('Login Success')
            login_user(user)
            return form.redirect('home')      
        flash('Invalid Credentials')
    return render_template('account/login.html', form=form)

@account.route('/logout', methods=['GET'])
def logout():
    if current_user.is_authenticated:
        logout_user()
        flash('You have successfully logged out')
    return redirect(url_for('main.home'))

@account.route('/profile/<username>', methods=['GET'])
def profile(username):
    user = User.query.filter_by(username=username).first()
    if not user:
        return redirect(url_for('main.home'))
    return render_template('account/profile.html', user=user)

@account.route('/account/settings')
@login_required
def account_settings():
    return render_template('account/settings.html')

@account.route('/account/change_password', methods=['GET', 'POST'])
@login_required
def change_password():
    form = ChangePasswordForm()
    if form.validate_on_submit():
        current_user.password = form.password.data
        db.session.add(current_user)
        db.session.commit()
        flash('Your password has been changed')
        return redirect(url_for('account.change_password'))
    return render_template('account/change_password.html', form=form)

@account.route('/account/change_email', methods=['GET', 'POST'])
@login_required
def change_email():
    form = ChangeEmailForm()
    if form.validate_on_submit():
        current_user.email = form.email.data
        db.session.add(current_user)
        db.session.commit()
        flash ('Your email has been changed')
        redirect(url_for('account.change_email'))
    return render_template('account/change_email.html', form=form)

@account.route('/account/info', methods=['GET', 'POST'])
@login_required
def account_info():
    form = CurrentUserDataForm()
    form.username.data = current_user.username
    form.email.data = current_user.email
    form.username.disabled = True
    form.email.disabled = True
    return render_template('account/info.html', form=form)
