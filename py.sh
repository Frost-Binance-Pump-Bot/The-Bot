rm -rf Python-3.9.7 Python-3.9.7.tar.xz

wget https://www.python.org/ftp/python/3.9.7/Python-3.9.7.tar.xz

tar xvf Python-3.9.7.tar.xz

cd Python-3.9.7

./configure

sudo make -s altinstall

cd

which python3.9

echo "alias python3='python3.9'" > .bashrc
echo "alias pip3='pip3.9'" > .bashrc
echo "alias python='python3.9'" > .bashrc
echo "alias pip='pip3.9'" > .bashrc

source .bashrc

python -V
pip -V

pip3.9 install keyboard web3

echo "Ready To Launch Python 3.9 Files!"
