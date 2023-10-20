import acm.program.ConsoleProgram;

public class Pr25 extends ConsoleProgram {
	
	public void run(){
		
		int num1 = readInt("Enter Number N1: ");
		int num2 = readInt("Enter Number N2: ");
		
		usj(num1, num2);
		
	}
	
	private void usj(int a, int b){
		
		for(int c=0; c<b; c++){
			
			if((a*(c+1))%b==0)
				{
				println((a*(c+1)));
				break;
				}
		}
		
	}

}
