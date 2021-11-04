PYPATH = "/tmp/Python397"

mkdir $PYPATH
cd $PYPATH

wget https://www.python.org/ftp/python/3.9.7/Python-3.9.7.tar.xz

tar xvf Python-3.9.7.tar.xz

cd Python-3.9.7

./configure

sudo make altinstall

which python3.9

alias python3='python3.9'
alias pip3='pip3.9'
alias python='python3.9'
alias pip='pip3.9'

python -V
pip -V
