import React from 'react';
import '../styles/Home.css';
import Navbar from '../Components/Navbar';

const Home = ({ onNavigate }) => {
  return (
    <div className="home">
      <Navbar onNavigate={onNavigate} />

      {/* Hero Section */}
      <section className="hero">
        <h1>Welcome to Cryptex</h1>
        <p>Cryptex is your training platform for mastering cryptocurrency trading.</p>
      </section>

    </div>
  );
};

export default Home;