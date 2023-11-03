import acm.graphics.GOval;
import acm.program.GraphicsProgram;
import acm.util.RandomGenerator;

import java.awt.*;
import java.util.Random;

public class Pr34 extends GraphicsProgram {

    public void run(){

       for (int a = 0; a<1000; a++){

           add(drawCircle(radiusRandomizer(0, getHeight()/4), colorRandomizer()), xRandom(), yRandom());

       }

    }


    private GOval drawCircle(double radius, Color color){

        GOval circle = new GOval(radius*2, radius*2);
        circle.setFilled(true);
        circle.setColor(color);
        return circle;

    }

    private Color colorRandomizer(){

        RandomGenerator randomizer = new RandomGenerator();
        Color color = randomizer.nextColor();
        return color;
    }

    private double xRandom(){

        Random x = new Random();
        double xCord = x.nextDouble()*getWidth();
        return xCord;

    }

    private double yRandom(){

        RandomGenerator y = new RandomGenerator();
        double yCord = y.nextDouble()*getHeight();
        return yCord;
    }
    private double radiusRandomizer(int a, int b){

        RandomGenerator c = new RandomGenerator();
        double r = a+(b-a)*c.nextDouble();
        return r;

    }
}
