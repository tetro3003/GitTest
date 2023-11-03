import acm.graphics.GOval;
import acm.program.GraphicsProgram;

import java.awt.*;
import java.util.Random;

public class Pr33 extends GraphicsProgram {

    public void run(){

        drawCircle(radiusRandomizer(10,300), colorRandomizer());

    }

    private void drawCircle(double radius, Color color){

        GOval circle = new GOval(radius*2, radius*2);
        circle.setFilled(true);
        circle.setColor(color);
        add(circle, getWidth()/2-radius, getHeight()/2-radius);

    }

    private Color colorRandomizer(){

        Random randomizer = new Random();
        float randomColor = randomizer.nextFloat();
        float randomColor1 = randomizer.nextFloat();
        float randomColor2 = randomizer.nextFloat();
        Color color = new Color(randomColor,randomColor1,randomColor2);

        return color;
    }
    private double radiusRandomizer(int a, int b){

        Random c = new Random();
        double r = a+(b-a)*c.nextDouble();
        return r;

    }
}
